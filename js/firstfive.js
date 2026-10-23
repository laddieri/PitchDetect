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
 * Practice opens on a menu of activities (showPracticeMenu()):
 *   Learn  — the lessons above
 *   Quiz   — the challenge round: CHALLENGE_LENGTH notes mixed at random,
 *            staff only: name each note, then play it into the mic. Help
 *            reveals a note's name (big), fingering and sound, but only notes
 *            named first try and played without help score.
 *   Names  — a drill: name each note shown on the staff (no mic)
 *   Fingerings — a drill: name the note a fingering chart shows (no mic)
 * Rounds score notes done unaided; the best score per instrument is kept.
 * The drills are races against the clock: as many as you can in
 * DRILL_SECONDS, trying to beat your best.
 *
 * Learn the first 3 notes is an easier start: concert D C B♭ (FIRST3_STEPS),
 * the first three notes many band methods begin with, taught the same way.
 * Flute and oboe also get B, A and G (FIRST3_BAG_STEPS), where their classes
 * usually start: each set has its own lesson, drills, songs and song writing
 * cards (THREE_SET_ACTIVITIES); the one opened sets practice.threeSet.
 *
 * Learn the B♭ scale extends the lessons to the first octave: concert
 * B♭ C D E♭ F G A B♭ (SCALE_STEPS) from the same starting B♭, eight lessons
 * with their own stars. Play the B♭ scale is a challenge round in order, up
 * the octave and back down (scaleRunSequence()), with Help like the quiz.
 * The concert E♭, A♭, F and C scales (MORE_SCALES) follow, taught the same
 * way and spelled in the student's written key, then the chromatic scale
 * (CHROMATIC_STEPS: every half step from B♭ up the octave), its fingerings
 * the chromatic ones where they differ (chromaticFingerings, fingerings.js).
 * The 9 note quiz (startNineQuiz()) is the quiz over the first five notes
 * and notes 6 and beyond; the 3 note quiz (startThreeQuiz(set)) is the quiz
 * over a set of first 3 notes (one card per set on flute and oboe).
 *
 * SONGS is a list of tunes made of the first 3 notes (Hot Cross
 * Buns and more), the first five notes (Mary Had a Little Lamb, Jingle Bells
 * and more), then tunes on
 * the whole B♭ scale (Twinkle, Twinkle, London Bridge...). The staff shows
 * one line (two measures) at a time with the note to play glowing; each note
 * passes after SONG_HOLD_MS, and a repeated note must be tongued again.
 * Hear the song plays the whole tune; Help works like the quiz's. My songs:
 * the student copies a tune from their own music into a song editor
 * (openSongEditor()) and plays it the same way.
 *
 * Flute, clarinet, alto sax, oboe and the brass also get a "first sounds"
 * tutorial (startFirstSounds(), configured by FIRST_SOUNDS): playing just the
 * head joint / mouthpiece and barrel / mouthpiece and neck / reed (a crow) /
 * mouthpiece (a buzz) before the first notes.
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
var SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11, 12];  // B♭ C D E♭ F G A B♭
var CHROMATIC_STEPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];  // every half step, B♭ to B♭
var FIRST3_STEPS = [4, 2, 0];  // D C B♭, stepping down to the first B♭
var FIRST3_BAG_STEPS = [1, -1, -3];  // B A G, the flute and oboe start
var FIRST3_BAG_INSTRUMENTS = ["flute", "oboe"];
// Notes 6 and beyond: notes 6 to 9 in most band methods, in the order
// they're usually taught: concert G, A♭, the A♭ an octave lower, the low A
var NEXT4_STEPS = [9, 10, -2, -1];
// The concert scales band students learn after B♭, each a lesson set of its
// own: tonic, steps from the first B♭ to the scale's first note; octave, the
// instruments that start it an octave away (to stay in a beginner's range
// and on their charts: flute, oboe and horn would climb too high in E♭, and
// tenor sax's low F is off its range, tuba's a long way down); run, the
// storage of its scale run's best. Each also has drills and a scale run,
// their ids the B♭ scale's plus the key: namesscaleEb, scalerunEb...
var MAJOR_SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11, 12];
var MORE_SCALES = [
	{ id: "scaleEb", name: "E\u266d", tonic: 5, storage: "pitchdetect-eb-scale", run: "pitchdetect-eb-scale-run",
		octave: { "treble clef": -12, "flute": -12, "oboe": -12, "horn": -12, "glockenspiel": -12 } },
	{ id: "scaleAb", name: "A\u266d", tonic: -2, storage: "pitchdetect-ab-scale", run: "pitchdetect-ab-scale-run" },
	{ id: "scaleF", name: "F", tonic: -5, storage: "pitchdetect-f-scale", run: "pitchdetect-f-scale-run",
		octave: { "tenor sax": 12, "tuba": 12 } },
	{ id: "scaleC", name: "C", tonic: 2, storage: "pitchdetect-c-scale", run: "pitchdetect-c-scale-run" }
];

var PRACTICE_STORAGE_KEY = "pitchdetect-first-five";
var PRACTICE_HOLD_MS = 1200;       // how long the note must be held to pass
var PRACTICE_PASS_CENTS = 30;      // "close enough" for a beginner
var PRACTICE_TUNE_CENTS = 12;      // average offset for the in-tune star
var PRACTICE_GAP_MS = 250;         // dropouts shorter than this keep the hold
var PRACTICE_HINT_FRAMES = 4;      // frames a wrong note must last to be named
var PRACTICE_GHOST_CLEAR_MS = 600; // silence before the wrong-note ghost goes
// Pitch trace: the lesson Play step, quiz and scale run draw the pitch being
// played on the staff, a line running right from the target note
var PITCH_TRACE_MS = 2500;         // history shown across the staff
var PITCH_TRACE_FINE = 8;          // staff units 50¢ is drawn from the target (zoomed in)
var PITCH_TRACE_SMOOTHING = 0.35;  // per-frame EMA on the drawn pitch
var PITCH_TRACE_BREAK_MS = 150;    // silence that breaks the line
var PRACTICE_TRACE_STAFF_WIDTH = 230; // lesson/quiz staff, wide for the trace
var PITCH_LADDER_WIDTH = 36;       // room kept at the right for brass's partial ladder
var PITCH_LADDER_RANGE = 19.5;     // semitones either side of the target it shows (an octave and a fifth)
// Tuning tips: a student who plays every note a bit flat (or sharp) needs
// their instrument tuned or their embouchure firmed, not "push it up" note
// after note
var TUNING_NOTE_MIN_MS = 400;      // time near the target for a note to count
var TUNING_SAMPLES = 3;            // notes in a row leaning the same way...
var TUNING_BIAS_CENTS = 15;        // ...by at least this much on average
var TUNING_STUCK_MS = 2500;        // or one note held right but too low/high
var TUNING_TIP_COOLDOWN_MS = 45000; // between tips

var CHALLENGE_STORAGE_KEY = "pitchdetect-first-five-challenge";
var CHALLENGE_LENGTH = 10;
var CHALLENGE_HOLD_MS = 800;       // shorter hold keeps the round moving
// The 9 note quiz: the first five notes and notes 6 and beyond
var QUIZ9_STORAGE_KEY = "pitchdetect-nine-note-quiz";
var QUIZ9_LENGTH = 12;
// The 3 note quiz, one per set of first 3 notes (best kept per set)
var QUIZ3_STORAGE_KEYS = { first3: "pitchdetect-three-note-quiz", first3bag: "pitchdetect-three-note-quiz-bag" };
var QUIZ3_LENGTH = 6;
// Timed drill bests (the key changed when drills went from 10 questions to
// a race against the clock, so old scores out of 10 don't count as bests)
var DRILL_STORAGE_KEY = "pitchdetect-first-five-drills-timed";
var DRILL_SECONDS = 30;            // length of a drill round
var DRILL_STAR_GOAL = 15;          // notes for 3 stars (12 for 2, 8 for 1)
var DRILL_NEXT_MS = 500;           // pause on a right answer before the next
var DRILL_BALLOON_GOAL = 10;       // right answers that pop the balloon, until
                                   // the best reaches it; then beat the best
var SCALE_STORAGE_KEY = "pitchdetect-bb-scale";
var SCALE_RUN_STORAGE_KEY = "pitchdetect-bb-scale-run";
var FIRST3_STORAGE_KEY = "pitchdetect-first-three";
var FIRST3_BAG_STORAGE_KEY = "pitchdetect-first-three-bag";
var NEXT4_STORAGE_KEY = "pitchdetect-next-four";
var CHROMATIC_STORAGE_KEY = "pitchdetect-chromatic-scale";
var CHROMATIC_RUN_STORAGE_KEY = "pitchdetect-chromatic-scale-run";

// The note sets taught as lessons: the first three notes (D C B♭, or B A G
// on flute and oboe), the first five notes, notes 6 and beyond, the B♭ scale
// and the chromatic scale (its activities' ids like a scale's: scalerunChromatic)
var LESSON_SETS = {
	first3: { steps: FIRST3_STEPS, storage: FIRST3_STORAGE_KEY },
	first3bag: { steps: FIRST3_BAG_STEPS, storage: FIRST3_BAG_STORAGE_KEY },
	first5: { steps: PRACTICE_STEPS, storage: PRACTICE_STORAGE_KEY },
	next4: { steps: NEXT4_STEPS, storage: NEXT4_STORAGE_KEY },
	scale: { steps: SCALE_STEPS, storage: SCALE_STORAGE_KEY },
	scaleChromatic: { steps: CHROMATIC_STEPS, storage: CHROMATIC_STORAGE_KEY }
};
// ...and the concert E♭, A♭, F and C scales, spelled in the student's
// written key (spell: trumpet's concert C scale is D major, with F♯ and C♯)
MORE_SCALES.forEach(function(scale) {
	LESSON_SETS[scale.id] = {
		steps: MAJOR_SCALE_STEPS.map(function(step) { return scale.tonic + step; }),
		storage: scale.storage, octave: scale.octave, spell: true
	};
});

// A lesson set's steps on an instrument (some start a scale an octave away)
function lessonSteps(set, instrument) {
	var shift = (set.octave && set.octave[instrument]) || 0;
	return set.steps.map(function(step) { return step + shift; });
}

// The concert scale (MORE_SCALES) of lesson set id, or null
function moreScale(id) {
	return MORE_SCALES.filter(function(scale) { return scale.id === id; })[0] || null;
}

// Where each scale run's best is kept, by lesson set ("scale" is B♭)
var SCALE_RUN_STORAGE_KEYS = { scale: SCALE_RUN_STORAGE_KEY, scaleChromatic: CHROMATIC_RUN_STORAGE_KEY };
MORE_SCALES.forEach(function(scale) { SCALE_RUN_STORAGE_KEYS[scale.id] = scale.run; });

// A scale's name by lesson set ("scale" is B♭)
function scaleName(set) {
	if (set === "scaleChromatic") return "chromatic";
	return set === "scale" ? "B\u266d" : moreScale(set).name;
}

// The scale (lesson set) a scale drill or run activity is on, or null:
// "namesscale" and "scalerun" are on "scale", "fingeringsscaleEb" and
// "scalerunEb" on "scaleEb"
function scaleSetOf(id) {
	var m = /^(?:names|fingerings)scale(\w*)$|^scalerun(\w*)$/.exec(id);
	if (!m) return null;
	var set = "scale" + (m[1] || m[2] || "");
	return LESSON_SETS[set] ? set : null;
}

var practiceOpen = false;
var practiceStartedMic = false;
var practiceAdvanceTimer = null;
var drillClockTimer = null;
var practice = null;  // per-session state, see openPractice()

// Written MIDI notes of a lesson set (default: the first five notes) for the
// selected instrument
function practiceNotes(steps) {
	var instrument = document.getElementById("instrument").value;
	var start = practiceStartConcertMidi[instrument];
	if (start === undefined) start = 70;
	var t = getTransposition();
	return (steps || PRACTICE_STEPS).map(function(step) { return start + step + t; });
}

// Spelling of a written MIDI note in the lessons: flats, as band parts read,
// except F♯ (alto and bari sax read concert A as F♯, never G♭)
function practiceSpelling(writtenMidi) {
	var pc = ((writtenMidi % 12) + 12) % 12;
	// A scale's lesson, drills and run spell its notes as its written key does
	var spellings = !practice ? null
		: practice.mode === "lesson" ? currentLesson().spellings
		: (practice.mode === "challenge" || practice.mode === "drill") && practice.challenge ? practice.challenge.spellings
		: null;
	if (spellings && spellings[pc]) return spellings[pc];
	return plainPracticeSpelling(writtenMidi);
}

// The lessons' spelling before any scale's: flats, and F♯
function plainPracticeSpelling(writtenMidi) {
	var pc = ((writtenMidi % 12) + 12) % 12;
	return pc === 6 ? "F#" : flatNoteSpellings[pc];
}

// Note letter for a written MIDI note
function practiceNoteName(writtenMidi) {
	return keyDisplayName(practiceSpelling(writtenMidi));
}

// Best stars per note of a lesson set (count notes) for an instrument
function loadPracticeStars(instrument, key, count) {
	try {
		var all = JSON.parse(progressGet(key) || "{}");
		var stars = all[instrument];
		if (Array.isArray(stars) && stars.length === count) return stars;
	} catch (e) {}
	return new Array(count).fill(0);
}

function savePracticeStars(instrument, stars, key) {
	try {
		var all = JSON.parse(progressGet(key) || "{}");
		all[instrument] = stars;
		progressSet(key, JSON.stringify(all));
	} catch (e) {}
}

// Best challenge score (notes played without help) for an instrument, or
// null. key: the quiz's or the scale run's storage.
function loadChallengeBest(instrument, key) {
	try {
		var best = JSON.parse(progressGet(key || CHALLENGE_STORAGE_KEY) || "{}")[instrument];
		if (typeof best === "number") return best;
	} catch (e) {}
	return null;
}

function saveChallengeBest(instrument, score, key) {
	try {
		var all = JSON.parse(progressGet(key || CHALLENGE_STORAGE_KEY) || "{}");
		all[instrument] = score;
		progressSet(key || CHALLENGE_STORAGE_KEY, JSON.stringify(all));
	} catch (e) {}
}

// Trophy stars for a round score out of total (10 / 8 / 5 of 10)
function challengeStars(score, total) {
	total = total || CHALLENGE_LENGTH;
	return score >= total ? 3 : score >= total * 0.8 ? 2 : score >= total * 0.5 ? 1 : 0;
}

// The three notes an instrument starts on: B A G ("first3bag") on flute and
// oboe, D C B♭ ("first3") for everyone else. Flute and oboe have both sets'
// cards; this one is on their learning path.
function defaultThreeSet(instrument) {
	return FIRST3_BAG_INSTRUMENTS.indexOf(instrument) < 0 ? "first3" : "first3bag";
}

// Best drill scores for an instrument: { names: n, fingerings: n, names3: n,
// names3bag: n, ... } (3-note drills keep a best per note set)
function loadDrillBest(instrument) {
	try {
		var best = JSON.parse(progressGet(DRILL_STORAGE_KEY) || "{}")[instrument];
		if (best && typeof best === "object") return best;
	} catch (e) {}
	return {};
}

function saveDrillBest(instrument, best) {
	try {
		var all = JSON.parse(progressGet(DRILL_STORAGE_KEY) || "{}");
		all[instrument] = best;
		progressSet(DRILL_STORAGE_KEY, JSON.stringify(all));
	} catch (e) {}
}

// "★★☆"-style text for 0–3 stars
function starText(stars) {
	return "\u2605\u2605\u2605".slice(0, stars) + "\u2606\u2606\u2606".slice(0, 3 - stars);
}

// The lesson set being taught: { id, notes, stars, storage }
function currentLesson() {
	return practice.lessons[practice.lesson];
}

function allNotesLearned() {
	return currentLesson().stars.every(function(s) { return s > 0; });
}

function openPractice() {
	// A student practices on their own instrument: picked at sign-in,
	// changed on the profile
	applyStudentInstrument();

	// Practice owns the audio while it's open
	if (sustainPlaying) stopSustain();
	if (listenActive) stopListening();
	closePopovers();

	practiceOpen = true;
	practiceStartedMic = false;
	var view = document.getElementById("practice-view");
	view.hidden = false;
	view.setAttribute("data-whole", songWholeView ? "1" : "0");
	document.querySelector(".container").inert = true;

	loadPracticeInstrument();
	// Nobody has signed in on this device yet: who's practicing?
	if (!practiceSignedIn()) {
		showSignIn("open");
		return;
	}
	if (!practice.instrument) {
		showInstrumentStep("open");
		return;
	}
	showPracticeMenu();
	document.getElementById("practice-close").focus();
	if (pendingSongImport) openSongImport();
}

// Load practice state for the app's selected instrument
function loadPracticeInstrument() {
	var select = document.getElementById("instrument");
	var lessons = {};
	Object.keys(LESSON_SETS).forEach(function(id) {
		var set = LESSON_SETS[id];
		var notes = practiceNotes(lessonSteps(set, select.value));
		lessons[id] = {
			id: id,
			notes: notes,
			stars: loadPracticeStars(select.value, set.storage, set.steps.length),
			storage: set.storage,
			spellings: set.spell ? scaleSpellings(notes) : null
		};
	});
	practice = {
		instrument: select.value,
		mode: "menu",
		lessons: lessons,
		lesson: "first5",
		notes: lessons.first5.notes,  // the quiz and drills use the first five
		threeSet: defaultThreeSet(select.value),  // ...and the 3-note ones the set last opened
		// The menu shows a unit at a time, or every activity (teachers start there)
		menuAll: typeof profile !== "undefined" && profile && typeof profile.menuAll === "boolean"
			? profile.menuAll : teacherMode,
		fingeringKeys: {},
		challengeBest: loadChallengeBest(select.value),
		// Each scale run's best, by lesson set ("scale" is B♭)
		scaleRunBest: Object.keys(SCALE_RUN_STORAGE_KEYS).reduce(function(best, set) {
			best[set] = loadChallengeBest(select.value, SCALE_RUN_STORAGE_KEYS[set]);
			return best;
		}, {}),
		quiz9Best: loadChallengeBest(select.value, QUIZ9_STORAGE_KEY),
		quiz3Best: {
			first3: loadChallengeBest(select.value, QUIZ3_STORAGE_KEYS.first3),
			first3bag: loadChallengeBest(select.value, QUIZ3_STORAGE_KEYS.first3bag)
		},
		drillBest: loadDrillBest(select.value),
		songBest: loadSongBest(select.value),
		songSpeedBest: loadSongSpeedBest(select.value),
		customSongs: loadCustomSongs(select.value),
		firstSoundsBest: loadFirstSoundsBest(select.value),
		tuning: { notes: [], sum: 0, ms: 0, lowMs: 0, highMs: 0, tipAt: -Infinity },
		index: 0,
		step: -1
	};
	// The header names the instrument; the profile changes it (in teacher
	// mode it's a drop-down, updateTeacherHeader())
	var option = select.options[select.selectedIndex];
	var label = document.getElementById("practice-instrument");
	label.textContent = select.value && option ? option.textContent : "";
	label.parentNode.style.visibility = select.value || teacherMode ? "" : "hidden";
	onPracticeLoaded();
}

// The view's data-mode drives which parts show (menu vs. activity card, and
// the note map only for lessons). Switching modes also ends any fireworks
// still playing from the last result.
function setPracticeMode(mode) {
	stopSongPlayback();
	removeSongFingerings();
	closeTuningTip();
	clearInterval(drillClockTimer);
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
	var arrows = document.getElementById("editor-staff-arrows");
	if (arrows) arrows.remove();
	schedulePracticeHistorySync();
	var back = document.getElementById("practice-close");
	var label = mode === "menu" ? "Back to the app"
		: mode === "song" || mode === "editor" ? "Back to the songs" : "Back to the practice menu";
	back.setAttribute("aria-label", label);
	back.title = label;
}

// Lesson set for each lesson activity id
var LESSON_ACTIVITIES = { learn3bag: "first3bag", learn3: "first3", learn: "first5", learn4: "next4", scale: "scale",
	scaleEb: "scaleEb", scaleAb: "scaleAb", scaleF: "scaleF", scaleC: "scaleC", scaleChromatic: "scaleChromatic" };

// Whether an activity is offered on the current instrument
function practiceActivityAvailable(id) {
	if (id === "firstsounds") return !!FIRST_SOUNDS[practice.instrument];
	var a = PRACTICE_ACTIVITIES.filter(function(a) { return a.id === id; })[0];
	return !a || !a.instruments || a.instruments.indexOf(practice.instrument) >= 0;
}

// The 3-note activities and the note set each works on. Flute and oboe get
// a card for each set ("...bag" on B A G); opening one sets practice.threeSet,
// which the drills, songs and song writing then follow.
var THREE_SET_ACTIVITIES = {
	learn3: "first3", names3: "first3", fingerings3: "first3", songs3: "first3", write3: "first3",
	quiz3: "first3",
	learn3bag: "first3bag", names3bag: "first3bag", fingerings3bag: "first3bag", songs3bag: "first3bag", write3bag: "first3bag",
	quiz3bag: "first3bag"
};

// A 3-note activity id for set set: threeSetActivity("names3", "first3bag")
// is "names3bag"
function threeSetActivity(id, set) {
	return id + (set === "first3bag" ? "bag" : "");
}

// The first 3 notes lesson on the student's path: B A G on flute and oboe,
// D C B♭ for everyone else
function firstThreeActivity() {
	return threeSetActivity("learn3", defaultThreeSet(practice.instrument));
}

// The written notes of a set of first 3 notes, as taught (top down)
// (default: the set last opened)
function threeNotes(set) {
	return practice.lessons[set || practice.threeSet].notes;
}

// "G, A♭ (high and low) and A"-style names of notes 6 and beyond
function nextFourText() {
	var names = practice.lessons.next4.notes.map(practiceNoteName);
	return names[0] + ", " + names[1] + " (high and low) and " + names[3];
}

// "B, A and G"-style names of a set of first 3 notes
function threeNotesText(set) {
	return notesText(threeNotes(set));
}

// "B\u266d, C, D, E\u266d and F"-style names of written notes
function notesText(notes) {
	var names = notes.map(practiceNoteName);
	return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
}

// The menu's pages, one tab each: the lessons that teach each set of notes,
// the practice drills and quizzes on them, and the songs and song writing
var PRACTICE_PAGES = [
	{ id: "lessons", label: "Lessons" },
	{ id: "drills", label: "Practice drills" },
	{ id: "songs", label: "Songs" }
];

// The activities, each with its best result for this instrument, in menu
// order on their page, easiest first, so each page reads top to bottom like
// a path. Half-width cards pair up on desktop.
var PRACTICE_ACTIVITIES = [
	{ id: "firstsounds", firstSounds: true, page: "lessons", wide: true },  // title, sub and icon from FIRST_SOUNDS
	{ id: "learn3bag", icon: "\u266a", title: "Learn B, A and G", sub: "", instruments: FIRST3_BAG_INSTRUMENTS, page: "lessons", wide: true },
	{ id: "learn3", icon: "\u266a", title: "Learn the first 3 notes", sub: "Start here: three easy notes, one at a time", page: "lessons", wide: true },
	{ id: "learn", icon: "\u266a", title: "Learn the first 5 notes", sub: "Read, finger, hear and play each note", page: "lessons", wide: true },
	{ id: "learn4", icon: "\u266a", title: "Learn notes 6 and beyond", sub: "", page: "lessons", wide: true },  // sub: nextFourText()
	{ id: "scale", icon: "scale", title: "Learn the B\u266d scale", sub: "All eight notes, up the octave", page: "lessons", wide: true },
	{ id: "scaleEb", icon: "scale", title: "Learn the E\u266d scale", sub: "", page: "lessons" },  // sub: moreScaleText()
	{ id: "scaleAb", icon: "scale", title: "Learn the A\u266d scale", sub: "", page: "lessons" },
	{ id: "scaleF", icon: "scale", title: "Learn the F scale", sub: "", page: "lessons" },
	{ id: "scaleC", icon: "scale", title: "Learn the C scale", sub: "", page: "lessons" },
	{ id: "scaleChromatic", icon: "scale", title: "Learn the chromatic scale", sub: "", page: "lessons", wide: true },  // sub: chromaticText()
	{ id: "quiz3bag", icon: "trophy", title: "", sub: "", instruments: FIRST3_BAG_INSTRUMENTS, page: "drills", group: "playing" },  // title: the notes
	{ id: "quiz3", icon: "trophy", title: "3 note quiz", sub: "", page: "drills", group: "playing" },  // sub: the notes
	{ id: "quiz", icon: "trophy", title: "First 5 note quiz", sub: "Play the notes you see", page: "drills", group: "playing" },
	{ id: "quiz9", icon: "trophy", title: "9 note quiz", sub: "The first 5 and your new notes", page: "drills", group: "playing" },
	{ id: "scalerun", icon: "scalerun", title: "Play the B\u266d scale", sub: "Up and back down, note by note", page: "drills", group: "playing", wide: true },
	{ id: "scalerunEb", icon: "scalerun", title: "Play the E\u266d scale", sub: "Up and back down, note by note", page: "drills", group: "playing" },
	{ id: "scalerunAb", icon: "scalerun", title: "Play the A\u266d scale", sub: "Up and back down, note by note", page: "drills", group: "playing" },
	{ id: "scalerunF", icon: "scalerun", title: "Play the F scale", sub: "Up and back down, note by note", page: "drills", group: "playing" },
	{ id: "scalerunC", icon: "scalerun", title: "Play the C scale", sub: "Up and back down, note by note", page: "drills", group: "playing" },
	{ id: "scalerunChromatic", icon: "scalerun", title: "Play the chromatic scale", sub: "Every half step, up and back down", page: "drills", group: "playing", wide: true },
	{ id: "names3bag", icon: "A\u00a0B", title: "", sub: "", instruments: FIRST3_BAG_INSTRUMENTS, page: "drills", group: "names" },  // title: the notes
	{ id: "names3", icon: "A\u00a0B", title: "Name the 3 notes", sub: "", page: "drills", group: "names" },  // sub: the notes
	{ id: "names", icon: "A\u00a0B", title: "Name the first 5 notes", sub: "", page: "drills", group: "names" },  // sub: the notes
	{ id: "names9", icon: "A\u00a0B", title: "Name 9 notes", sub: "The first 5 and your new notes", page: "drills", group: "names" },
	{ id: "namesscale", icon: "A\u00a0B", title: "Name the B\u266d scale notes", sub: "", page: "drills", group: "names" },  // sub: its range
	{ id: "namesscaleEb", icon: "A\u00a0B", title: "Name the E\u266d scale notes", sub: "", page: "drills", group: "names" },
	{ id: "namesscaleAb", icon: "A\u00a0B", title: "Name the A\u266d scale notes", sub: "", page: "drills", group: "names" },
	{ id: "namesscaleF", icon: "A\u00a0B", title: "Name the F scale notes", sub: "", page: "drills", group: "names" },
	{ id: "namesscaleC", icon: "A\u00a0B", title: "Name the C scale notes", sub: "", page: "drills", group: "names" },
	{ id: "fingerings3bag", icon: "fingering", title: "", sub: "", instruments: FIRST3_BAG_INSTRUMENTS, page: "drills", group: "fingerings" },  // title: the notes
	{ id: "fingerings3", icon: "fingering", title: "Finger the 3 notes", sub: "", page: "drills", group: "fingerings" },  // sub: the notes
	{ id: "fingerings", icon: "fingering", title: "Finger the first 5 notes", sub: "", page: "drills", group: "fingerings" },  // sub: the notes
	{ id: "fingerings9", icon: "fingering", title: "Finger 9 notes", sub: "The first 5 and your new notes", page: "drills", group: "fingerings" },
	{ id: "fingeringsscale", icon: "fingering", title: "Finger the B\u266d scale", sub: "", page: "drills", group: "fingerings" },  // sub: its range
	{ id: "fingeringsscaleEb", icon: "fingering", title: "Finger the E\u266d scale", sub: "", page: "drills", group: "fingerings" },
	{ id: "fingeringsscaleAb", icon: "fingering", title: "Finger the A\u266d scale", sub: "", page: "drills", group: "fingerings" },
	{ id: "fingeringsscaleF", icon: "fingering", title: "Finger the F scale", sub: "", page: "drills", group: "fingerings" },
	{ id: "fingeringsscaleC", icon: "fingering", title: "Finger the C scale", sub: "", page: "drills", group: "fingerings" },
	{ id: "songs3bag", icon: "\u266b", title: "", sub: "Hot Cross Buns and more", instruments: FIRST3_BAG_INSTRUMENTS, page: "songs" },  // title: the notes
	{ id: "write3bag", icon: "pencil", title: "", sub: "Make up your own tune", instruments: FIRST3_BAG_INSTRUMENTS, page: "songs" },  // title: the notes
	{ id: "songs3", icon: "\u266b", title: "Play 3-note songs", sub: "Hot Cross Buns and more", page: "songs" },
	{ id: "write3", icon: "pencil", title: "Write a 3-note song", sub: "Make up your own tune", page: "songs" },
	{ id: "songs5", icon: "\u266b", title: "Play 5-note songs", sub: "Mary Had a Little Lamb, Jingle Bells and more", page: "songs" },
	{ id: "write5", icon: "pencil", title: "Write a 5-note song", sub: "Make up your own tune with your first 5 notes", page: "songs" },
	{ id: "songs", icon: "\u266b", title: "More songs", sub: "When the Saints, Twinkle, or make your own", page: "songs", wide: true }
];

// The units: Practice opens on a map of them all (menu page "map",
// showPracticeMap()); a unit's own menu page ("unit1"...) shows one at a time,
// with just that stretch of the path's cards in path order, so a beginner
// sees a few cards, not everything. The arrows step through them and, past
// the last, to every activity on the tabbed pages (PRACTICE_PAGES), which
// teachers start on. An activity may be in more than one unit (More songs).
// The path's steps say which unit they're in (learningPath()).
var PRACTICE_UNITS = [
	{ id: "unit1", title: "Your first notes", activities: ["firstsounds", "learn3bag", "learn3",
		"names3bag", "names3", "fingerings3bag", "fingerings3", "quiz3bag", "quiz3",
		"songs3bag", "songs3", "write3bag", "write3"] },
	{ id: "unit2", title: "The first 5 notes", activities: ["learn", "quiz", "names", "fingerings", "songs5", "write5"] },
	{ id: "unit3", title: "Notes 6 and beyond", activities: ["learn4", "names9", "fingerings9", "quiz9", "songs"] },
	{ id: "unit4", title: "The B♭ scale", activities: ["scale", "namesscale", "fingeringsscale", "scalerun", "songs"] },
	{ id: "unit5", title: "The E♭ scale", activities: ["scaleEb", "namesscaleEb", "fingeringsscaleEb", "scalerunEb", "songs"] },
	{ id: "unit6", title: "The A♭ scale", activities: ["scaleAb", "namesscaleAb", "fingeringsscaleAb", "scalerunAb", "songs"] },
	{ id: "unit7", title: "The F scale", activities: ["scaleF", "namesscaleF", "fingeringsscaleF", "scalerunF", "songs"] },
	{ id: "unit8", title: "The C scale", activities: ["scaleC", "namesscaleC", "fingeringsscaleC", "scalerunC", "songs"] },
	{ id: "unit9", title: "The chromatic scale", activities: ["scaleChromatic", "scalerunChromatic"] }
];

function practiceUnit(page) {
	return PRACTICE_UNITS.filter(function(u) { return u.id === page; })[0] || null;
}

function isPracticeMenuPage(page) {
	return page === "map" || !!practiceUnit(page) || PRACTICE_PAGES.some(function(p) { return p.id === page; });
}

// What a unit's notes are, for the card that leads to it
function practiceUnitSub(unit) {
	if (unit.id === "unit1") return threeNotesText(defaultThreeSet(practice.instrument));
	if (unit.id === "unit2") return notesText(practice.lessons.first5.notes);
	if (unit.id === "unit3") return nextFourText();
	if (unit.id === "unit4") return "All eight notes, and harder songs";
	if (unit.id === "unit9") return chromaticText();
	return moreScaleText(unit.activities[0]);  // a unit per concert scale
}

// The path's steps in a unit, and how many are done (null for the teacher,
// whose progress isn't kept)
function practiceUnitProgress(unit) {
	if (typeof learningPath !== "function" || !progressCounts()) return null;
	var nodes = learningPath().filter(function(n) { return n.unit === unit.id; });
	return { done: nodes.filter(function(n) { return n.done; }).length, total: nodes.length };
}

// The menu page to return to from activity id: its tab when showing every
// activity, else the unit on show if it has it, else the first unit with it
function menuPageFor(id) {
	if (practice.menuAll) return activityPage(id);
	var current = practiceUnit(practice.menuPage);
	if (current && current.activities.indexOf(id) >= 0) return current.id;
	return firstUnitWith(id);
}

// The first unit with activity id (null if none has it)
function firstUnitWith(id) {
	var unit = PRACTICE_UNITS.filter(function(u) { return u.activities.indexOf(id) >= 0; })[0];
	return unit ? unit.id : null;
}

// The page the menu opens on: the map of every unit
function defaultMenuPage() {
	return "map";
}

// The unit with the next step on the path (null for the teacher, or once
// the path is done)
function practiceCurrentUnit() {
	var next = typeof nextPathNode === "function" && progressCounts() ? nextPathNode() : null;
	return next ? practiceUnit(next.unit) : null;
}

// The map Practice opens on, like a game's overworld: every unit as a stop
// on a winding trail, the done ones gold, the student's avatar on the one
// with the next step, and a button on to that step. A unit's stop shows its
// summary first (showUnitSummary()); Every activity opens straight away.
function showPracticeMap(menu) {
	var next = typeof nextPathNode === "function" && progressCounts() ? nextPathNode() : null;
	var current = next ? practiceUnit(next.unit) : null;
	var avatar = typeof profile !== "undefined" && profile && progressCounts() && AVATARS[profile.avatar]
		? AVATARS[profile.avatar].icon : "";
	var trail = document.createElement("div");
	trail.className = "world-trail";
	var stops = PRACTICE_UNITS.concat([null]);  // then every activity
	var currentRow = null;
	stops.forEach(function(unit, i) {
		var row = document.createElement("div");
		row.className = "world-row " + (i % 2 ? "right" : "left");
		var progress = unit ? practiceUnitProgress(unit) : null;
		var done = !!progress && progress.total > 0 && progress.done === progress.total;
		var state = !unit ? "all" : done ? "done" : unit === current ? "current"
			: progress && progress.done ? "started" : "todo";
		row.setAttribute("data-state", state);
		if (unit) row.setAttribute("data-unit", unit.id);
		// The trail on to the next stop: gold up to the student's unit
		if (i < stops.length - 1) {
			var walked = state === "done" && (!current || PRACTICE_UNITS.indexOf(current) > i);
			var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.setAttribute("class", "world-path" + (walked ? " walked" : ""));
			svg.setAttribute("viewBox", "0 0 100 100");
			svg.setAttribute("preserveAspectRatio", "none");
			svg.setAttribute("aria-hidden", "true");
			var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
			path.setAttribute("d", i % 2 ? "M75,0 C75,55 25,45 25,100" : "M25,0 C25,55 75,45 75,100");
			path.setAttribute("vector-effect", "non-scaling-stroke");
			svg.appendChild(path);
			row.appendChild(svg);
		}
		var b = document.createElement("button");
		b.className = "world-stop";
		b.type = "button";
		b.setAttribute("data-page", unit ? unit.id : "lessons");
		b.innerHTML = '<span class="world-node"><span class="world-node-label"></span></span>' +
			'<span class="world-info"><span class="world-kicker"></span><span class="world-title"></span>' +
			'<span class="world-sub"></span></span>';
		b.querySelector(".world-node-label").textContent = !unit ? "\u2630" : done ? "\u2605" : String(i + 1);
		b.querySelector(".world-kicker").textContent = !unit ? "Review"
			: "Unit " + (i + 1) + (!progress || !progress.total ? ""
				: done ? " \u00b7 Done \u2713" : " \u00b7 " + progress.done + " of " + progress.total);
		b.querySelector(".world-title").textContent = unit ? unit.title : "Every activity";
		b.querySelector(".world-sub").textContent = unit ? practiceUnitSub(unit) : "Everything in one place";
		if (progress && progress.done && !done) {
			var meter = document.createElement("span");
			meter.className = "unit-meter world-meter";
			meter.innerHTML = '<span class="unit-meter-fill"></span>';
			meter.firstChild.style.width = (progress.done / progress.total * 100).toFixed(1) + "%";
			b.querySelector(".world-info").appendChild(meter);
		}
		if (state === "current" && avatar) {
			var me = document.createElement("span");
			me.className = "world-avatar";
			me.setAttribute("aria-hidden", "true");
			me.textContent = avatar;
			b.querySelector(".world-node").appendChild(me);
		}
		b.setAttribute("aria-label", (unit ? "Unit " + (i + 1) + ": " + unit.title : "Every activity") +
			(progress && progress.total ? ", " + progress.done + " of " + progress.total + " done" : "") +
			(state === "current" ? ", you are here" : ""));
		b.onclick = function() {
			if (unit) showUnitSummary(unit.id);
			else showPracticeMenu("lessons");
		};
		row.appendChild(b);
		trail.appendChild(row);
		if (state === "current") currentRow = row;
	});
	var scroller = document.createElement("div");
	scroller.className = "world-scroll";
	scroller.appendChild(trail);
	menu.appendChild(scroller);

	// On to the next step: its unit goes in history first, so back from the
	// step lands there, then on the map
	if (next) {
		var go = document.createElement("button");
		go.className = "practice-btn world-continue";
		go.type = "button";
		go.innerHTML = '<span class="world-continue-play" aria-hidden="true">\u25b6</span>' +
			'<span class="world-continue-text"><span class="world-continue-title"></span>' +
			'<span class="world-continue-sub"></span></span>';
		go.querySelector(".world-continue-title").textContent = "Next: " + next.title;
		go.querySelector(".world-continue-sub").textContent = "Unit " + (PRACTICE_UNITS.indexOf(current) + 1) + ": " + current.title;
		go.onclick = function() {
			showPracticeMenu(next.unit);
			syncPracticeHistory();
			startPathNode(next);
		};
		menu.appendChild(go);
	}
	// Bring the student's stop into view (the trail scrolls on a phone)
	if (currentRow) {
		requestAnimationFrame(function() {
			if (!scroller.isConnected) return;
			scroller.scrollTop = Math.max(0, currentRow.offsetTop - (scroller.clientHeight - currentRow.offsetHeight) / 2);
		});
	}
}

// The built-in songs a unit's More songs card is about: the songs with its
// new notes, the B♭ scale unit's harder songs, a concert scale's songs
function unitSongs(unit) {
	if (unit.id === "unit3") return SONGS.filter(function(song) { return song.level === "beyond"; });
	if (unit.id === "unit4") {
		return SONGS.filter(function(song) {
			return song.level === "intermediate" || song.level === "advanced" || song.id === "joyscale";
		});
	}
	var scale = unit.activities[0];
	if (!moreScale(scale)) return [];
	return SONGS.filter(function(song) {
		return song.level === "songs" + scale.slice(5) || song.id === "joy" + scale;
	});
}

// How an activity in unit is going: { stars, max, passed }. Stars are the
// menu card's (max 0 for song writing, which earns none). Passed: its steps
// on the learning path in the unit are done; off the path, every lesson
// note learned, all of first sounds, a song written, or any star.
function practiceActivityResult(id, unit, nodes) {
	var set = THREE_SET_ACTIVITIES[id];
	var stars = 0, max = 3, passed = null;
	if (LESSON_ACTIVITIES[id]) {
		var lesson = practice.lessons[LESSON_ACTIVITIES[id]].stars;
		stars = lesson.reduce(function(t, n) { return t + n; }, 0);
		max = lesson.length * 3;
		passed = lesson.every(function(n) { return n > 0; });
	} else if (id === "firstsounds") {
		stars = practice.firstSoundsBest || 0;
		passed = stars >= 3;
	} else if (/^(songs3|songs3bag|songs5|songs)$/.test(id)) {
		var list = id === "songs" ? unitSongs(unit) : listSongs(id === "songs5" ? "five" : "three");
		stars = list.reduce(function(t, song) { return t + songStars(song, set); }, 0);
		max = list.length * 3;
	} else if (/^write/.test(id)) {
		max = 0;
		passed = (set ? threeNoteCustomSongs(set) : fiveNoteCustomSongs()).length > 0;
	} else if (/^scalerun/.test(id)) {
		stars = challengeStars(practice.scaleRunBest[scaleSetOf(id)] || 0, scaleRunSequence(scaleSetOf(id)).length);
	} else if (id === "quiz") {
		stars = challengeStars(practice.challengeBest || 0);
	} else if (id === "quiz3" || id === "quiz3bag") {
		stars = challengeStars(practice.quiz3Best[set] || 0, QUIZ3_LENGTH);
	} else if (id === "quiz9") {
		stars = challengeStars(practice.quiz9Best || 0, QUIZ9_LENGTH);
	} else {
		stars = challengeStars(practice.drillBest[id] || 0, DRILL_STAR_GOAL);
	}
	var steps = (nodes || []).filter(function(n) { return n.unit === unit.id && n.activity === id; });
	if (steps.length) passed = steps.every(function(n) { return n.done; });
	else if (passed === null) passed = stars > 0;
	return { stars: stars, max: max, passed: passed };
}

// A unit's totals: { passed, total, stars, max }
function practiceUnitSummary(unit) {
	var nodes = typeof learningPath === "function" ? learningPath() : [];
	var sum = { passed: 0, total: 0, stars: 0, max: 0 };
	unit.activities.filter(practiceActivityAvailable).forEach(function(id) {
		var r = practiceActivityResult(id, unit, nodes);
		sum.total++;
		if (r.passed) sum.passed++;
		sum.stars += r.stars;
		sum.max += r.max;
	});
	return sum;
}

// The card a unit's stop on the map opens: how many of its activities are
// passed and its stars, with a button into the unit. It has its own place in
// history (practice.mapSummary), so back closes it.
function showUnitSummary(id) {
	var unit = practiceUnit(id);
	var card = document.getElementById("unit-summary");
	if (!unit || !card) return;
	practice.mapSummary = id;
	var index = PRACTICE_UNITS.indexOf(unit);
	var sum = practiceUnitSummary(unit);
	var done = sum.total > 0 && sum.passed === sum.total;
	card.setAttribute("data-state", done ? "done" : sum.passed || sum.stars ? "started" : "todo");
	card.querySelector(".unit-summary-badge").textContent = done ? "\u2605" : String(index + 1);
	card.querySelector(".unit-summary-kicker").textContent = "Unit " + (index + 1) + " of " + PRACTICE_UNITS.length;
	card.querySelector(".unit-summary-title").textContent = unit.title;
	card.querySelector(".unit-summary-sub").textContent = practiceUnitSub(unit);
	var stat = function(name, have, of) {
		var el = card.querySelector(".unit-summary-stat." + name);
		el.querySelector(".unit-summary-value").textContent = have;
		el.querySelector(".unit-summary-of").textContent = "of " + of;
		el.querySelector(".unit-meter-fill").style.width = (of ? have / of * 100 : 0).toFixed(1) + "%";
	};
	stat("passed", sum.passed, sum.total);
	stat("stars", sum.stars, sum.max);
	var next = typeof nextPathNode === "function" && progressCounts() ? nextPathNode() : null;
	var nextEl = card.querySelector(".unit-summary-next");
	nextEl.textContent = next && next.unit === unit.id ? "Next: " + next.title : "";
	var go = card.querySelector(".unit-summary-go");
	go.textContent = done ? "Play again" : sum.passed || sum.stars ? "Keep going" : "Let\u2019s go!";
	go.onclick = function() { showPracticeMenu(unit.id); };
	card.hidden = false;
	go.focus();
	syncPracticeHistory();
}

function unitSummaryOpen() {
	var card = document.getElementById("unit-summary");
	return !!card && !card.hidden;
}

// Close the unit card (sync: back through its history entry, unless a
// screen change is taking its place)
function closeUnitSummary(sync) {
	var card = document.getElementById("unit-summary");
	if (card) card.hidden = true;
	var id = practice && practice.mapSummary;
	if (practice) practice.mapSummary = null;
	if (sync && practiceOpen) {
		syncPracticeHistory();
		var stop = id && document.querySelector('.world-row[data-unit="' + id + '"] .world-stop');
		if (stop) stop.focus();
	}
}

// The unit bar above the menu: the unit on show, how far along it is, and
// arrows to the units either side (past the last: every activity)
function renderPracticeUnits(page) {
	var bar = document.getElementById("practice-units");
	bar.innerHTML = "";
	var unit = practiceUnit(page);
	var index = unit ? PRACTICE_UNITS.indexOf(unit) : PRACTICE_UNITS.length;
	var pageAt = function(i) { return i < PRACTICE_UNITS.length ? PRACTICE_UNITS[i].id : "lessons"; };
	var labelAt = function(i) {
		return i < PRACTICE_UNITS.length ? "Unit " + (i + 1) + ": " + PRACTICE_UNITS[i].title : "Every activity";
	};
	var arrow = function(dir) {
		var to = index + dir;
		var b = document.createElement("button");
		b.className = "unit-arrow " + (dir < 0 ? "prev" : "next");
		b.type = "button";
		b.textContent = dir < 0 ? "‹" : "›";
		if (to < 0 || to > PRACTICE_UNITS.length) {
			b.disabled = true;
			b.setAttribute("aria-label", dir < 0 ? "No earlier unit" : "No later unit");
		} else {
			b.setAttribute("data-page", pageAt(to));
			b.setAttribute("aria-label", labelAt(to));
			b.title = labelAt(to);
			b.onclick = function() { showPracticeMenu(pageAt(to)); };
		}
		return b;
	};
	var info = document.createElement("div");
	info.className = "unit-info";
	var kicker = document.createElement("span");
	kicker.className = "unit-kicker";
	var title = document.createElement("span");
	title.className = "unit-title";
	info.appendChild(kicker);
	info.appendChild(title);
	if (unit) {
		title.textContent = unit.title;
		var progress = practiceUnitProgress(unit);
		kicker.textContent = "Unit " + (index + 1) + " of " + PRACTICE_UNITS.length +
			(!progress || !progress.total ? ""
				: progress.done === progress.total ? " · Done ✓"
				: " · " + progress.done + " of " + progress.total + " done");
		if (progress && progress.total) {
			var meter = document.createElement("span");
			meter.className = "unit-meter";
			meter.innerHTML = '<span class="unit-meter-fill"></span>';
			meter.firstChild.style.width = (progress.done / progress.total * 100).toFixed(1) + "%";
			info.appendChild(meter);
		}
	} else {
		kicker.textContent = "All " + PRACTICE_UNITS.length + " units";
		title.textContent = "Every activity";
	}
	bar.appendChild(arrow(-1));
	bar.appendChild(info);
	bar.appendChild(arrow(1));
}

// The card at the end of a unit that leads on to the next one (or, after
// the last, to every activity)
function practiceUnitNextCard(unit) {
	var index = PRACTICE_UNITS.indexOf(unit);
	var next = PRACTICE_UNITS[index + 1];
	var progress = practiceUnitProgress(unit);
	var b = document.createElement("button");
	b.className = "practice-choice wide unit-next";
	b.innerHTML = '<span class="practice-choice-icon" aria-hidden="true">→</span>' +
		'<span class="practice-choice-text"><span class="practice-choice-title"></span>' +
		'<span class="practice-choice-sub"></span></span>';
	var lead = progress && progress.total && progress.done === progress.total ? "Up next" : "Coming up";
	b.querySelector(".practice-choice-title").textContent = next
		? lead + ": Unit " + (index + 2) + ", " + next.title : "Every activity";
	b.querySelector(".practice-choice-sub").textContent = next
		? practiceUnitSub(next) : "Everything in one place, for review";
	b.setAttribute("data-page", next ? next.id : "lessons");
	b.onclick = function() { showPracticeMenu(next ? next.id : "lessons"); };
	return b;
}

// The headings the Practice drills page groups its cards under (an
// activity's group)
function practiceGroupTitle(group) {
	if (group === "names") return "Practice note names";
	if (group === "fingerings") {
		return practice.instrument === "trombone" ? "Practice slide positions"
			: hasFingeringData(practice.instrument) ? "Practice fingerings" : "Practice the keyboard";
	}
	return "Practice playing notes";
}

// What each group's heading card says under its title
function practiceGroupSub(group) {
	if (group === "names") return "Read notes on the staff";
	if (group === "fingerings") {
		return practice.instrument === "trombone" ? "Match slide positions to notes"
			: hasFingeringData(practice.instrument) ? "Match fingerings to notes" : "Find notes on the keyboard";
	}
	return "Play notes on your instrument";
}

// The menu page an activity is on (null for screens off the menu)
function activityPage(id) {
	var a = PRACTICE_ACTIVITIES.filter(function(a) { return a.id === id; })[0];
	return a ? a.page : null;
}

// Show menu page page: a unit, or a tab of every activity. Without one, the
// menu stays on its page, leaving an activity returns to the page it's on,
// and otherwise the page with the next step on the learning path opens.
function showPracticeMenu(page) {
	if (!isPracticeMenuPage(page)) {
		page = practice.mode === "menu" ? practice.menuPage
			: menuPageFor(currentPracticeActivity()) || practice.menuPage;
		page = page || defaultMenuPage();
	}
	var unit = practiceUnit(page);
	var map = page === "map";
	// Showing every activity (or a unit) sticks for the student
	if (!map && practice.menuAll !== !unit) {
		practice.menuAll = !unit;
		if (typeof profile !== "undefined" && profile) {
			profile.menuAll = practice.menuAll;
			saveProfile();
		}
	}
	clearTimeout(practiceAdvanceTimer);
	stopNote();
	closeUnitSummary();
	practice.step = -1;
	practice.menuPage = page;
	setPracticeMode("menu");
	document.getElementById("practice-view").setAttribute("data-menu-page", page);
	var back = document.getElementById("practice-close");
	back.setAttribute("aria-label", map ? "Back to the app" : "Back to the map");
	back.title = back.getAttribute("aria-label");
	// Nothing on the menu listens; the mic restarts with the next Play step
	if (practiceStartedMic && listenActive) stopListening();
	practiceStartedMic = false;
	var menu = document.getElementById("practice-menu");
	menu.innerHTML = "";
	menu.toggleAttribute("data-world", map);
	if (map) {
		document.getElementById("practice-units").innerHTML = "";
		document.getElementById("practice-tabs").innerHTML = "";
		document.getElementById("practice-view").removeAttribute("data-menu-unit");
		menu.removeAttribute("data-unit");
		menu.removeAttribute("data-grouped");
		menu.removeAttribute("data-count");
		showPracticeMap(menu);
		onPracticeMenuShown(menu, page);
		return;
	}
	renderPracticeUnits(page);
	if (unit) document.getElementById("practice-tabs").innerHTML = "";
	else renderPracticeTabs(page);
	document.getElementById("practice-view").toggleAttribute("data-menu-unit", !!unit);
	var slide = practice.instrument === "trombone";
	var chart = hasFingeringData(practice.instrument);

	var fsCfg = FIRST_SOUNDS[practice.instrument];
	var activities = unit
		? unit.activities.map(function(id) {
			return PRACTICE_ACTIVITIES.filter(function(a) { return a.id === id; })[0];
		}).filter(function(a) { return practiceActivityAvailable(a.id); })
		: PRACTICE_ACTIVITIES.filter(function(a) {
			return practiceActivityAvailable(a.id) && a.page === page;
		});
	// A unit's cards pair up where they can; one left on its own is wide
	var wide = {}, pairing = [];
	activities.forEach(function(a) {
		if (!a.wide) pairing.push(a.id);
		if (a.wide || a === activities[activities.length - 1]) {
			if (unit && pairing.length % 2) wide[pairing[pairing.length - 1]] = true;
			pairing = [];
		}
	});
	// Flute and oboe have two sets of first 3 notes, so their 3-note cards
	// name the notes they're on
	var bag = practiceActivityAvailable("learn3bag");
	// (a unit's page also has the card leading on)
	menu.setAttribute("data-count", activities.length + (unit ? 1 : 0));
	var grouped = !unit && activities.some(function(a) { return a.group; });
	menu.toggleAttribute("data-grouped", grouped);
	var groupCards = null, lastGroup = null;
	activities.forEach(function(a) {
		var title = a.firstSounds ? fsCfg.title : a.title;
		var sub = a.firstSounds ? fsCfg.sub : a.sub;
		var set = THREE_SET_ACTIVITIES[a.id];
		if (a.id === "learn3bag") {
			sub = "Where most " + (practice.instrument === "oboe" ? "oboe" : "flute") + " classes start";
		} else if (a.id === "learn3" && bag) {
			title = "Learn " + threeNotesText(set);
			sub = "Where most band classes start";
		}
		if (a.id === "fingerings" && slide) {
			title = "Slide positions for the first 5 notes";
		} else if (a.id === "fingerings" && !chart) {
			title = "Find the first 5 notes on the keyboard";
		} else if (a.id === "fingerings3" && slide) {
			title = "Slide positions for 3 notes";
		} else if (a.id === "fingerings3" && !chart) {
			title = "Find the 3 notes on the keyboard";
		} else if (a.id === "fingerings9" && slide) {
			title = "Slide positions for 9 notes";
		} else if (a.id === "fingerings9" && !chart) {
			title = "Find 9 notes on the keyboard";
		} else if (/^fingeringsscale/.test(a.id) && slide) {
			title = "Slide positions for the " + scaleName(scaleSetOf(a.id)) + " scale";
		} else if (/^fingeringsscale/.test(a.id) && !chart) {
			title = "Find the " + scaleName(scaleSetOf(a.id)) + " scale on the keyboard";
		} else if (a.id === "write3" && !bag) {
			sub = "Make up your own tune with " + threeNotesText(set);
		}
		if (set && bag && a.id.indexOf("learn3") !== 0) {
			title = { names3: "Name ", fingerings3: "Finger ", songs3: "Play songs with ",
				write3: "Write a song with ", quiz3: "Play " }[a.id.replace(/bag$/, "")] + threeNotesText(set);
			if (/^(names|fingerings)3/.test(a.id)) sub = "3 notes, against the clock";
			if (/^quiz3/.test(a.id)) sub = "3 note quiz: play the notes you see";
		} else if (a.id === "names3" || a.id === "fingerings3" || a.id === "quiz3") {
			sub = threeNotesText(set);
		} else if (a.id === "names" || a.id === "fingerings") {
			sub = notesText(practice.lessons.first5.notes);
		} else if (/^(names|fingerings)scale/.test(a.id)) {
			var scaleNotes = practice.lessons[scaleSetOf(a.id)].notes;
			sub = practiceNoteName(scaleNotes[0]) + " up to " + practiceNoteName(scaleNotes[scaleNotes.length - 1]);
		} else if (a.id === "learn4") {
			sub = nextFourText();
		} else if (moreScale(a.id)) {
			sub = moreScaleText(a.id);
		} else if (a.id === "scaleChromatic") {
			sub = chromaticText();
		}

		var score;
		if (LESSON_ACTIVITIES[a.id]) {
			var stars = practice.lessons[LESSON_ACTIVITIES[a.id]].stars;
			var total = stars.reduce(function(t, n) { return t + n; }, 0);
			score = total + " / " + stars.length * 3 + " \u2605";
		} else if (a.firstSounds) {
			score = starText(practice.firstSoundsBest);
		} else if (a.id === "songs" || a.id === "songs3" || a.id === "songs3bag" || a.id === "songs5") {
			var list = listSongs({ songs: "all", songs3: "three", songs3bag: "three", songs5: "five" }[a.id]);
			var songTotal = list.reduce(function(t, song) { return t + songStars(song, set); }, 0);
			score = songTotal + " / " + list.length * 3 + " \u2605";
		} else if (a.id === "write3" || a.id === "write3bag" || a.id === "write5") {
			var mine = (set ? threeNoteCustomSongs(set) : fiveNoteCustomSongs()).length;
			score = mine ? mine + (mine === 1 ? " song" : " songs") : "New";
		} else if (/^scalerun/.test(a.id)) {
			var run = practice.scaleRunBest[scaleSetOf(a.id)];
			score = typeof run === "number" ? starText(challengeStars(run, scaleRunSequence(scaleSetOf(a.id)).length)) : "\u2606\u2606\u2606";
		} else if (a.id === "quiz") {
			var best = practice.challengeBest;
			score = typeof best === "number" ? starText(challengeStars(best)) : "\u2606\u2606\u2606";
		} else if (a.id === "quiz3" || a.id === "quiz3bag") {
			var best3 = practice.quiz3Best[set];
			score = typeof best3 === "number" ? starText(challengeStars(best3, QUIZ3_LENGTH)) : "\u2606\u2606\u2606";
		} else if (a.id === "quiz9") {
			var best9 = practice.quiz9Best;
			score = typeof best9 === "number" ? starText(challengeStars(best9, QUIZ9_LENGTH)) : "\u2606\u2606\u2606";
		} else {
			var drillBest = practice.drillBest[a.id];
			score = typeof drillBest === "number" ? "Best: " + drillBest : DRILL_SECONDS + " sec";
		}

		var b = document.createElement("button");
		b.className = "practice-choice" + (a.wide || wide[a.id] ? " wide" : "");
		b.setAttribute("data-activity", a.id);
		b.innerHTML = '<span class="practice-choice-icon" aria-hidden="true"></span>' +
			'<span class="practice-choice-text"><span class="practice-choice-title"></span>' +
			'<span class="practice-choice-sub"></span></span>' +
			'<span class="practice-choice-score"></span>';
		var icon = b.firstChild;
		if (a.icon === "trophy") icon.innerHTML = TROPHY_SVG;
		else if (a.icon === "fingering") icon.innerHTML = FINGERING_SVG;
		else if (a.icon === "scale") icon.innerHTML = SCALE_SVG;
		else if (a.icon === "scalerun") icon.innerHTML = SCALE_RUN_SVG;
		else if (a.icon === "pencil") icon.innerHTML = PENCIL_SVG;
		else if (a.firstSounds) icon.innerHTML = fsCfg.icon;
		else icon.textContent = a.icon;
		b.querySelector(".practice-choice-title").textContent = title;
		b.querySelector(".practice-choice-sub").textContent = sub;
		b.querySelector(".practice-choice-score").textContent = score;
		b.onclick = function() { startPracticeActivity(a.id); };
		if (grouped && a.group !== lastGroup) {
			lastGroup = a.group;
			menu.appendChild(practiceGroupSection(a.group));
			groupCards = menu.lastChild.querySelector(".practice-group-cards");
		}
		(grouped ? groupCards : menu).appendChild(b);
	});
	if (unit) menu.appendChild(practiceUnitNextCard(unit));
	menu.toggleAttribute("data-unit", !!unit);
	onPracticeMenuShown(menu, page);
}

// A heading and its cards on the Practice drills page. The heading is a
// button that folds the cards away (remembered on this device).
function practiceGroupSection(group) {
	var section = document.createElement("section");
	section.className = "practice-group";
	section.setAttribute("data-group", group);
	var heading = document.createElement("h3");
	heading.className = "practice-group-title";
	var toggle = document.createElement("button");
	toggle.className = "practice-choice practice-group-toggle";
	toggle.setAttribute("data-group", group);
	toggle.id = "practice-group-" + group;
	toggle.innerHTML = '<span class="practice-choice-icon" aria-hidden="true"></span>' +
		'<span class="practice-choice-text"><span class="practice-choice-title practice-group-name"></span>' +
		'<span class="practice-choice-sub"></span></span>' +
		'<span class="practice-group-chevron" aria-hidden="true"></span>';
	var icon = toggle.firstChild;
	if (group === "names") icon.textContent = "A\u00a0B";
	else icon.innerHTML = group === "fingerings" ? FINGERING_SVG : TROPHY_SVG;
	toggle.querySelector(".practice-group-name").textContent = practiceGroupTitle(group);
	toggle.querySelector(".practice-choice-sub").textContent = practiceGroupSub(group);
	heading.appendChild(toggle);
	var cards = document.createElement("div");
	cards.className = "practice-group-cards";
	cards.id = "practice-group-cards-" + group;
	toggle.setAttribute("aria-controls", cards.id);
	var setOpen = function(open) {
		section.classList.toggle("closed", !open);
		toggle.setAttribute("aria-expanded", open ? "true" : "false");
		cards.hidden = !open;
	};
	setOpen(!practiceGroupsClosed()[group]);
	toggle.onclick = function() {
		var closed = practiceGroupsClosed();
		closed[group] = !closed[group];
		if (!closed[group]) delete closed[group];
		try { localStorage.setItem(PRACTICE_GROUPS_STORAGE_KEY, JSON.stringify(closed)); } catch (e) {}
		setOpen(!closed[group]);
	};
	section.appendChild(heading);
	section.appendChild(cards);
	return section;
}

// The Practice drills groups folded away: { names: true, ... }
var PRACTICE_GROUPS_STORAGE_KEY = "pitchdetect-drill-groups-closed";
function practiceGroupsClosed() {
	try {
		var closed = JSON.parse(localStorage.getItem(PRACTICE_GROUPS_STORAGE_KEY) || "{}");
		if (closed && typeof closed === "object") return closed;
	} catch (e) {}
	return {};
}

// The page tabs above the menu
function renderPracticeTabs(page) {
	var tabs = document.getElementById("practice-tabs");
	tabs.innerHTML = "";
	PRACTICE_PAGES.forEach(function(p) {
		var b = document.createElement("button");
		b.className = "practice-tab";
		b.setAttribute("role", "tab");
		b.setAttribute("data-page", p.id);
		b.setAttribute("aria-selected", p.id === page ? "true" : "false");
		b.textContent = p.label;
		b.onclick = function() { showPracticeMenu(p.id); };
		tabs.appendChild(b);
	});
}

function startPracticeActivity(id) {
	if (THREE_SET_ACTIVITIES[id]) practice.threeSet = THREE_SET_ACTIVITIES[id];
	id = id.replace(/^(songs3|write3)bag$/, "$1");
	if (LESSON_ACTIVITIES[id]) {
		startLesson(LESSON_ACTIVITIES[id]);
	} else if (id === "quiz") {
		startChallenge();
	} else if (id === "quiz3" || id === "quiz3bag") {
		startThreeQuiz(practice.threeSet);
	} else if (id === "quiz9") {
		startNineQuiz();
	} else if (/^scalerun/.test(id)) {
		startScaleRun(scaleSetOf(id));
	} else if (id === "firstsounds") {
		startFirstSounds();
	} else if (id === "songs") {
		showSongList("all");
	} else if (id === "songs3") {
		showSongList("three");
	} else if (id === "songs5") {
		showSongList("five");
	} else if (id === "write3") {
		// The 3-note song list goes in history first, so back steps out to it
		syncPracticeHistory();
		showSongList("three");
		syncPracticeHistory();
		openSongEditor(null, practice.threeSet);
	} else if (id === "write5") {
		syncPracticeHistory();
		showSongList("five");
		syncPracticeHistory();
		openSongEditor(null, "first5");
	} else if (id === "profile") {
		showProfile();
	} else if (id === "signin") {
		showSignIn(practice.signinFrom);
	} else {
		startDrill(id);
	}
}

// The back arrow (and Escape): an activity returns to its menu page, a
// menu page to the map, and the map leaves practice
function practiceBack() {
	if (practice && practice.mode === "signin") {
		// Practice needs someone signed in on an instrument
		if (practice.signinStep === "samename") showSignIn(practice.signinFrom);
		else if (!practiceSignedIn() || !practice.instrument) closePractice();
		else if (practice.signinFrom === "profile") showProfile();
		else showPracticeMenu();
		return;
	}
	if (practice && (practice.mode === "song" || practice.mode === "editor")) {
		showSongList();
	} else if (practice && practice.mode !== "menu") {
		showPracticeMenu();
	} else if (unitSummaryOpen()) {
		closeUnitSummary(true);
	} else if (practice && practice.menuPage !== "map") {
		showPracticeMenu("map");
	} else {
		closePractice();
	}
}

// The activity the student is in (for history)
function currentPracticeActivity() {
	if (practice.mode === "lesson") {
		return Object.keys(LESSON_ACTIVITIES).filter(function(id) { return LESSON_ACTIVITIES[id] === practice.lesson; })[0];
	}
	if (practice.mode === "challenge") {
		if (practice.challenge.kind === "quiz3") return threeSetActivity("quiz3", practice.challenge.set);
		if (practice.challenge.kind === "scale") return "scalerun" + practice.challenge.set.slice(5);
		return { quiz9: "quiz9" }[practice.challenge.kind] || "quiz";
	}
	if (practice.mode === "drill") return practice.drillKind;
	if (practice.mode === "firstsounds") return "firstsounds";
	if (practice.mode === "profile" || practice.mode === "signin") return practice.mode;
	if (practice.mode === "songs" || practice.mode === "song" || practice.mode === "editor") {
		return practice.songList === "three" ? threeSetActivity("songs3", practice.threeSet)
			: practice.songList === "five" ? "songs5" : "songs";
	}
	return "menu";
}

function closePractice() {
	if (!practiceOpen) return;
	practiceOpen = false;
	stopSongPlayback();
	closeTuningTip();
	closeUnitSummary();
	clearTimeout(practiceAdvanceTimer);
	clearInterval(drillClockTimer);
	stopNote();
	if (practiceStartedMic && listenActive) stopListening();
	practiceStartedMic = false;
	document.getElementById("practice-view").hidden = true;
	document.querySelector(".container").inert = false;
	syncPracticeHistory();
	var button = document.getElementById("practiceButton");
	if (button && button.offsetParent !== null) button.focus();
}

// "Concert E♭: F up to F": a concert scale and where it starts and ends at
// the student's written pitch
function moreScaleText(id) {
	var notes = practice.lessons[id].notes;
	var name = practiceNoteName(notes[0]);
	return "Concert " + moreScale(id).name + ": " + name + " up to " + name;
}

// "Every half step, C up to C": the chromatic scale at the student's
// written pitch
function chromaticText() {
	var name = practiceNoteName(practice.lessons.scaleChromatic.notes[0]);
	return "Every half step, " + name + " up to " + name;
}

// Open a lesson set ("first3", "first5", "next4", "scale" or one of
// MORE_SCALES): an overview of its notes and their names first, so the Read
// step never asks a name before it's taught
function startLesson(id) {
	practice.lesson = id;
	if (id.indexOf("first3") === 0) practice.threeSet = id;
	showLessonOverview();
}

// Every note of the lesson on one staff, named, with Hear them and a button
// into the first note that still has stars to earn
function showLessonOverview() {
	clearTimeout(practiceAdvanceTimer);
	stopNote();
	setPracticeMode("lesson");
	practice.index = -1;
	practice.step = -1;
	document.getElementById("practice-view").setAttribute("data-step", "overview");
	document.getElementById("practice-steps").innerHTML = "";
	var notes = currentLesson().notes;
	var more = moreScale(practice.lesson);
	document.getElementById("practice-prompt").textContent = more ? "Meet the concert " + more.name + " scale!"
		: practice.lesson === "scale" ? "Meet the B\u266d scale!"
		: practice.lesson === "scaleChromatic" ? "Meet the chromatic scale!"
		: practice.lesson === "next4" ? "Meet notes 6 and beyond!"
		: practice.lesson.indexOf("first3") === 0 ? "Meet your first 3 notes!" : "Meet your first 5 notes!";
	drawLessonOverview(-1);

	var body = document.getElementById("practice-body");
	body.innerHTML = "";
	var text = document.createElement("div");
	text.className = "practice-feedback-sub";
	text.textContent = "Learn their names. Next, we\u2019ll practice them one at a time.";
	body.appendChild(text);
	var actions = document.createElement("div");
	actions.className = "practice-actions";
	var hear = practiceButton("\u25b6 Hear them", "secondary", function() {
		if (songPlayTimer !== null) {
			stopSongPlayback();
			return;
		}
		hear.textContent = "\u25a0 Stop";
		playSongEvents(notes.map(function(midi) { return { midi: midi, dur: "h" }; }), drawLessonOverview);
	});
	hear.id = "overview-hear";
	actions.appendChild(hear);
	actions.appendChild(practiceButton("Let\u2019s start \u2192", "primary", function() {
		var next = currentLesson().stars.findIndex(function(s) { return s < 3; });
		startPracticeNote(next >= 0 ? next : 0);
	}));
	body.appendChild(actions);
}

// The overview's staff: the lesson's notes with their names lined up
// underneath, note hl (while Hear them plays) in the accent color
function drawLessonOverview(hl) {
	var out = document.getElementById("practice-staff-output");
	out.innerHTML = "";
	var VF = Vex.Flow;
	var clef = getCurrentClef();
	var notes = currentLesson().notes;
	var styles = getComputedStyle(document.body);
	var accent = styles.getPropertyValue("--accent").trim() || "#4f46e5";
	var W = 50 + notes.length * 40, H = STAFF_VIEWBOX_HEIGHT;
	var renderer = new VF.Renderer(out, VF.Renderer.Backends.SVG);
	renderer.resize(W, H);
	var context = renderer.getContext();
	var stave = new VF.Stave(5, Math.round((H - 4 * LINE_SPACING) / 2), W - 10);
	stave.addClef(clef);
	stave.setContext(context).draw();
	var tickables = [];
	try {
		tickables = notes.map(function(midi, i) {
			var spelled = practiceSpelling(midi);
			var note = new VF.StaveNote({ clef: clef, keys: [spelled.toLowerCase() + "/" + (Math.floor(midi / 12) - 1)], duration: "w" });
			if (spelled.length > 1) note.addAccidental(0, new VF.Accidental(spelled.charAt(1)));
			if (i === hl) note.setStyle({ fillStyle: accent, strokeStyle: accent });
			return note;
		});
		var voice = new VF.Voice({ num_beats: 4 * notes.length, beat_value: 4 }).setStrict(false);
		voice.addTickables(tickables);
		new VF.Formatter().joinVoices([voice]).format([voice], stave.getNoteEndX() - stave.getNoteStartX() - 10);
		voice.draw(context, stave);
	} catch (e) {
		console.log("Could not render the lesson overview:", e.message);
		tickables = [];
	}

	var svg = out.querySelector("svg");
	if (!svg) return;
	// The names share one line below the staff and the lowest note
	var top = stave.getYForLine(0) - 2 * LINE_SPACING;
	var low = stave.getYForLine(4);
	tickables.forEach(function(t) {
		top = Math.min(top, t.getYs()[0] - 2 * LINE_SPACING);
		low = Math.max(low, t.getYs()[0]);
	});
	var baseline = low + 28;
	tickables.forEach(function(t, i) {
		var text = document.createElementNS("http://www.w3.org/2000/svg", "text");
		text.setAttribute("x", t.getAbsoluteX() + t.getGlyphWidth() / 2);
		text.setAttribute("y", baseline);
		text.setAttribute("text-anchor", "middle");
		text.setAttribute("class", "overview-name");
		if (i === hl) text.setAttribute("fill", accent);
		text.textContent = practiceNoteName(notes[i]);
		svg.appendChild(text);
	});
	var bottom = baseline + 6;
	svg.setAttribute("viewBox", "0 " + top + " " + W + " " + (bottom - top));
	svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
	svg.style.width = "100%";
	svg.style.height = "100%";
}

// Begin (or restart) the lesson for note i of the current set
function startPracticeNote(i) {
	setPracticeMode("lesson");
	practice.index = i;
	practice.target = currentLesson().notes[i];
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
		// One button per name (the scale's two B♭s share one)
		var seen = {};
		var choices = currentLesson().notes.filter(function(midi) {
			var pc = ((midi % 12) + 12) % 12;
			if (seen[pc]) return false;
			seen[pc] = true;
			return true;
		});
		answers.setAttribute("data-count", choices.length);
		choices.forEach(function(midi) {
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

// The target's (or midi's) fingering chart (or its piano key, for
// instruments without charts) in a box for the step body. noCenter: leave a
// trombone chart for the caller to center (see centerChartsTogether()).
function practiceFingeringBox(hideName, midi, noCenter) {
	if (midi === undefined) midi = practice.target;
	var box = document.createElement("div");
	box.className = "practice-fingering";
	if (hasFingeringData(practice.instrument)) {
		box.style.setProperty("--fingering-h", fingeringBoxHeight(practice.instrument));
		displayFingering(box, practice.instrument, midi, false);
		if (chromaticNow()) displayChromaticFingering(box, practice.instrument, midi);
		if (FLUTE_B_THUMB_CHARTS.indexOf(midi) >= 0 && fluteBThumbNow()) {
			box.querySelector("img.fingering-image").src = "img/Fingerings/Flute/" + midi + "-b-thumb.png";
		}
		if (practice.instrument === "trombone" && !noCenter) centerChartDrawing(box);
		if (practice.instrument === "clarinet" && !noCenter) trimClarinetCharts([box]);
	} else {
		box.style.setProperty("--fingering-h", "134px");  // the keyboard at 300px wide
		var concertPc = (((midi - getTransposition()) % 12) + 12) % 12;
		drawPianoKeyboard(concertPc, hideName ? "" : practiceNoteName(midi), box);
	}
	return box;
}

// Trombone charts share one wide canvas so the bell stays put and the slide
// reaches right; in a lone chart that blank reach reads as the picture
// sitting left of center. Shift the image so its drawn part is centered (the
// box clips the blank part pushed past its edge). Skipped if the pixels
// can't be read.
function centerChartDrawing(box) {
	centerChartsTogether([box]);
}

// The same for several charts shown in turn (Hear the song): one shift for
// all, centering the span they draw together, so the bell stays put from
// chart to chart and only the slide moves. Waits for every image to load.
function centerChartsTogether(boxes) {
	var imgs = [];
	boxes.forEach(function(box) {
		var img = box.querySelector("img.fingering-image");
		if (img) imgs.push(img);
	});
	whenImagesLoaded(imgs, function() {
		var minX = Infinity, maxX = -1, width = 0;
		for (var i = 0; i < imgs.length; i++) {
			var span = chartDrawnSpan(imgs[i]);
			if (!span) return;
			minX = Math.min(minX, span[0]);
			maxX = Math.max(maxX, span[1]);
			width = span[2];
		}
		if (maxX < 0) return;
		var shift = "translateX(" + ((width - (minX + maxX + 1)) / 2 / width * 100) + "%)";
		imgs.forEach(function(img) { img.style.transform = shift; });
	});
}

// The clarinet diagram is drawn on one canvas with room for every key
// group, so a note without pinky or throat keys leaves much of it blank and
// the holes small. Crop the canvas to what's drawn (for charts shown in
// turn, to what they draw together, so the holes keep one size), and drop
// the empty caption line under it.
function trimClarinetCharts(boxes) {
	var svgs = [];
	boxes.forEach(function(box) {
		box.querySelectorAll(".clarinet-fingering svg").forEach(function(svg) { svgs.push(svg); });
		box.querySelectorAll(".clarinet-caption").forEach(function(caption) {
			if (!caption.textContent.trim()) caption.remove();
		});
	});
	if (!svgs.length) return;
	// getBBox() needs the drawing on the page: measure it out of sight
	var probe = document.createElement("div");
	probe.style.cssText = "position: absolute; left: -9999px; top: 0; visibility: hidden;";
	document.body.appendChild(probe);
	var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
	svgs.forEach(function(svg) {
		var next = svg.nextSibling, parent = svg.parentNode;
		probe.appendChild(svg);
		var b = svg.getBBox();
		parent.insertBefore(svg, next);
		minX = Math.min(minX, b.x);
		minY = Math.min(minY, b.y);
		maxX = Math.max(maxX, b.x + b.width);
		maxY = Math.max(maxY, b.y + b.height);
	});
	probe.remove();
	if (!(maxX > minX && maxY > minY)) return;
	var pad = 3;  // half the outline, and a little room
	var x = minX - pad, y = minY - pad, w = maxX - minX + pad * 2, h = maxY - minY + pad * 2;
	svgs.forEach(function(svg) {
		svg.setAttribute("viewBox", [x, y, w, h].join(" "));
		svg.setAttribute("width", w);
		svg.setAttribute("height", h);
	});
}

// Call fn once every image has loaded (or failed: a chart missing for a note
// shouldn't hold up the rest). Nothing is called if there are no images.
function whenImagesLoaded(imgs, fn) {
	var waiting = imgs.length;
	function done() {
		if (--waiting === 0) fn();
	}
	imgs.forEach(function(img) {
		if (img.complete) done();
		else {
			img.addEventListener("load", done, { once: true });
			img.addEventListener("error", done, { once: true });
		}
	});
}

// Chart images shown in turn (Hear the song) on one shared canvas. Each box
// fits its own image on its own, so a chart cropped narrower or shorter
// would sit somewhere else at another size. Here every image keeps one scale
// and its place from fingeringImageBox(), inside a stage sized to the span
// they cover together, so the tone holes stay put from note to note. The
// sizes are known up front, so this is laid out at once, not after the
// images load (on a slow connection that could be most of the song).
// boxes: { midi: box }.
function lineUpChartImages(boxes) {
	var charts = [];
	Object.keys(boxes).forEach(function(midi) {
		var img = boxes[midi].querySelector("img.fingering-image");
		if (img) charts.push({ img: img, at: fingeringImageBox(practice.instrument, +midi) });
	});
	if (!charts.length) return;
	var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
	charts.forEach(function(c) {
		minX = Math.min(minX, c.at[0]);
		minY = Math.min(minY, c.at[1]);
		maxX = Math.max(maxX, c.at[0] + c.at[2]);
		maxY = Math.max(maxY, c.at[1] + c.at[3]);
	});
	var w = maxX - minX, h = maxY - minY;
	charts.forEach(function(c) {
		var stage = document.createElement("div");
		stage.className = "chart-stage";
		stage.style.aspectRatio = w + " / " + h;
		// Fit the box, never past the images' own size
		stage.style.height = "min(100cqh, " + h + "px, calc(100cqw * " + (h / w) + "))";
		var img = c.img;
		img.parentNode.insertBefore(stage, img);
		stage.appendChild(img);
		img.style.position = "absolute";
		img.style.left = ((c.at[0] - minX) / w * 100) + "%";
		img.style.top = ((c.at[1] - minY) / h * 100) + "%";
		img.style.width = (c.at[2] / w * 100) + "%";
		img.style.height = (c.at[3] / h * 100) + "%";
		img.style.maxWidth = "none";
		img.style.aspectRatio = "auto";
		img.style.objectFit = "fill";
		img.style.margin = "0";
	});
}

// Flutes starting on B, A and G keep the thumb on the B-natural key the
// whole time (G and A play either way), so the B A G lesson, its fingering
// drill and songs on just those notes show G and A with the thumb there
// too, not on the B-flat lever as the charts do.
var FLUTE_B_THUMB_NOTES = [67, 69, 71];  // written G4, A4, B4
var FLUTE_B_THUMB_CHARTS = [67, 69];     // the charts with a -b-thumb copy

// Whether the chromatic scale's lesson or run is on, whose charts show the
// chromatic fingerings (chromaticFingerings)
function chromaticNow() {
	if (practice.mode === "lesson") return practice.lesson === "scaleChromatic";
	if (practice.mode === "challenge") return practice.challenge.set === "scaleChromatic";
	return false;
}

function fluteBThumbNow() {
	if (practice.instrument !== "flute") return false;
	if (practice.mode === "lesson") return practice.lesson === "first3bag";
	if (practice.mode === "drill") return /bag$/.test(practice.drillKind);
	if (practice.mode === "challenge") return practice.challenge.set === "first3bag";
	if (practice.mode === "song" && practice.song) return fluteBThumbSong(practice.song.events);
	return false;
}

function fluteBThumbSong(events) {
	return practice.instrument === "flute" && events.every(function(e) {
		return e.midi === null || FLUTE_B_THUMB_NOTES.indexOf(e.midi) >= 0;
	});
}

// The columns of an image that hold drawing: [first, last, width] (last is
// -1 if blank), or null if the pixels can't be read
function chartDrawnSpan(img) {
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
		return [minX, maxX, w];
	} catch (e) {
		// Cross-origin or decode failure: leave the chart as drawn
		return null;
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
	endTuningNote();
	practice.holdMs = 0;
	practice.centsTotal = 0;
	practice.lastFrame = null;
	practice.lastGood = 0;
	practice.lastSound = 0;
	practice.hintDiff = null;
	practice.hintFrames = 0;
	practice.ghost = null;
	clearPitchTrace();
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

// The practice header's mic badge shows whenever the mic is on
// (startListening() / stopListening() call this)
function updatePracticeMicBadge() {
	var mic = document.getElementById("practice-mic");
	if (!mic) return;
	mic.hidden = !listenActive;
	if (!listenActive) mic.style.removeProperty("--mic-level");
}

// Called from the mic loop every frame while practice is open. freq is the
// confidently detected concert frequency, or null for silence/noise; level is
// the frame's RMS loudness (songs use it to hear a repeated note re-tongued).
function updatePracticeListen(now, freq, level) {
	var mic = document.getElementById("practice-mic");
	if (mic) mic.style.setProperty("--mic-level", Math.min(1, (level || 0) * 8).toFixed(2));
	if (practice && practice.mode === "firstsounds") {
		updateFirstSoundsListen(now, freq);
		return;
	}
	if (practice && practice.mode === "song") {
		updateSongListen(now, freq, level || 0);
		return;
	}
	if (!practice || practice.step !== 3) return;
	var dt = practice.lastFrame === null ? 0 : Math.min(now - practice.lastFrame, 100);
	practice.lastFrame = now;
	if (tuningTipOpen()) return;
	// The scale run is reading from the staff, so its feedback never names
	// the target (naming what the student actually played is fine); the
	// quiz has the student name it before playing
	var challenge = practice.mode === "challenge";
	var hideName = challenge && practice.challenge.kind === "scale";
	var name = practiceNoteName(practice.target);
	var holdNeeded = challenge ? CHALLENGE_HOLD_MS : PRACTICE_HOLD_MS;

	if (now < (practice.ignoreUntil || 0)) {
		setPracticeFeedback("Listen\u2026", "\u00a0");
		pushPitchTrace(now, null);
		return;
	}

	var inZone = false;
	if (freq) {
		practice.lastSound = now;
		var written = 69 + 12 * Math.log(freq / 440) / Math.LN2 + getTransposition();
		var diff = written - practice.target;  // semitones, fractional
		var cents = diff * 100;
		pushPitchTrace(now, diff);
		trackTuning(cents, dt);
		if (Math.abs(cents) <= PRACTICE_PASS_CENTS) {
			inZone = true;
			practice.holdMs += dt;
			practice.centsTotal += Math.abs(cents) * dt;
			practice.lastGood = now;
			practice.hintDiff = null;
			practice.hintFrames = 0;
			setPracticeGhost(null);
			setPracticeFeedback(Math.abs(cents) <= PRACTICE_TUNE_CENTS ? "Just right! Hold it\u2026" : "That\u2019s it! Hold it\u2026",
				Math.abs(cents) <= PRACTICE_TUNE_CENTS ? "\u00a0" : (cents < 0 ? "A tiny bit low" : "A tiny bit high"), "good");
		} else {
			practiceWrongNoteHint(diff, hideName);
		}
	} else {
		pushPitchTrace(now, null);
		if (now - practice.lastSound > PRACTICE_GHOST_CLEAR_MS) setPracticeGhost(null);
	}
	if (!freq && now - practice.lastSound > 1500) {
		setPracticeFeedback(hideName ? "Hold it until the bar fills" : "Play " + name + " and hold it", "\u00a0");
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

// Feedback for a note outside the pass zone (diff: semitones from the
// target). A wrong note is named only once it's steady, so attacks don't
// flash hints. hideTarget keeps the target's name out of the hint.
function practiceWrongNoteHint(diff, hideTarget) {
	var cents = diff * 100;
	var r = Math.round(diff);
	if (r === practice.hintDiff) {
		practice.hintFrames++;
	} else {
		practice.hintDiff = r;
		practice.hintFrames = 1;
	}
	if (practice.hintFrames < PRACTICE_HINT_FRAMES) return;
	// A wrong note shows faintly beside the target, so the student sees how
	// far off it is (a slightly out-of-tune right note doesn't; squeaks
	// beyond an octave would only clutter the staff)
	setPracticeGhost(r !== 0 && Math.abs(r) <= 12 ? practice.target + r : null);
	var partial = r !== 0 ? brassPartialMiss(diff) : 0;
	if (partial) {
		// Brass on the wrong partial: the fingers are fine, the lips and air aren't
		var played = r % 12 === 0
			? (hideTarget ? "the same note, " + (r > 0 ? "higher" : "lower") : "a " + (r > 0 ? "higher " : "lower ") + practiceNoteName(practice.target))
			: practiceNoteName(practice.target + r);
		var right = practice.instrument === "trombone" ? "Right slide" : "Right fingers";
		setPracticeFeedback(right + (partial > 0 ? ", too high!" : ", too low!"),
			"That was " + played + (partial > 0 ? ". Relax your lips and use slower air." : ". Firm up your lips and use faster air."), "off");
	} else if (r === 0) {
		setPracticeFeedback(cents < 0 ? "A little low" : "A little high",
			cents < 0 ? "Push the pitch up a bit" : "Relax the pitch down a bit", "close");
	} else if (r % 12 === 0) {
		var which = hideTarget ? "one" : practiceNoteName(practice.target);
		setPracticeFeedback("Right note, wrong octave",
			r > 0 ? "That\u2019s a higher " + which + " \u2014 try the lower one" : "That\u2019s a lower " + which + " \u2014 try the higher one", "off");
	} else {
		var check = practice.instrument === "trombone" ? ". Check your slide."
			: hasFingeringData(practice.instrument) ? ". Check your fingering." : ". Try again.";
		setPracticeFeedback("Not quite!", "That sounded like " + practiceNoteName(practice.target + r) + check, "off");
	}
}

// Each brass instrument's open fundamental (concert MIDI), and the harmonic
// series above it in semitones (partials 2-12; the 7th and 11th are too out
// of tune to be fingered for, so they never pick a fingering)
var BRASS_FUNDAMENTALS = { trumpet: 46, horn: 29, trombone: 34, euphonium: 34, tuba: 22 };
var BRASS_PARTIALS = [12, 19.02, 24, 27.86, 31.02, 33.69, 36, 38.04, 39.86, 41.51, 43.02];

// The notes the target's fingering plays on a brass instrument, as written
// pitches (fractional: partials aren't tempered), low to high; null if not
// brass. The fingering is the shortest tubing (valves down or slide out by
// 0-6 semitones) that has the target as a partial, which is how charts
// finger nearly every note. The 7th and 11th partials are too out of tune to
// be fingered for, so they never pick the fingering and aren't listed.
function brassPartials(target) {
	var fund = BRASS_FUNDAMENTALS[practice.instrument];
	if (fund === undefined) return null;
	var shift = getTransposition();
	var tuned = BRASS_PARTIALS.filter(function(p, i) { return i !== 5 && i !== 9; });
	for (var lower = 0; lower <= 6; lower++) {
		var notes = tuned.map(function(p) { return fund - lower + p + shift; });
		if (notes.some(function(n) { return Math.abs(n - target) < 0.35; })) return notes;
	}
	return null;
}

// Whether a wrong note (diff semitones from the target) is another partial
// of the target's fingering: 1 above, -1 below, 0 not (or not brass)
function brassPartialMiss(diff) {
	var notes = brassPartials(practice.target);
	if (!notes) return 0;
	var played = practice.target + diff;
	var other = notes.some(function(n) {
		return Math.abs(n - played) < 0.5 && Math.abs(n - practice.target) > 0.5;
	});
	return other ? (diff > 0 ? 1 : -1) : 0;
}

// ---------------------------------------------------------------------------
// Tuning tips
// ---------------------------------------------------------------------------

// Each frame of the right note (within half a semitone of the target) adds
// to the note's average offset; a note held right but outside the pass zone
// for TUNING_STUCK_MS brings up the tip straight away, since the student
// can't pass until it's fixed.
function trackTuning(cents, dt) {
	var t = practice.tuning;
	if (Math.abs(cents) >= 50 || !tuningTip(practice.instrument, false)) return;
	t.sum += cents * dt;
	t.ms += dt;
	if (cents < -PRACTICE_PASS_CENTS) t.lowMs += dt;
	if (cents > PRACTICE_PASS_CENTS) t.highMs += dt;
	if (t.lowMs >= TUNING_STUCK_MS || t.highMs >= TUNING_STUCK_MS) {
		var sharp = t.highMs >= TUNING_STUCK_MS;
		// Only if earlier notes don't lean the other way
		var against = t.notes.slice(-TUNING_SAMPLES).filter(function(c) {
			return sharp ? c < -TUNING_BIAS_CENTS : c > TUNING_BIAS_CENTS;
		}).length;
		t.lowMs = t.highMs = 0;
		if (!against) showTuningTip(sharp);
	}
}

// A note is over (resetPracticeHold): keep its average offset, and when the
// last few all lean the same way, show the tip
function endTuningNote() {
	var t = practice.tuning;
	if (!t) return;
	if (t.ms >= TUNING_NOTE_MIN_MS) {
		t.notes.push(t.sum / t.ms);
		if (t.notes.length > TUNING_SAMPLES) t.notes.shift();
	}
	t.sum = t.ms = t.lowMs = t.highMs = 0;
	if (t.notes.length < TUNING_SAMPLES) return;
	var mean = t.notes.reduce(function(a, c) { return a + c; }, 0) / t.notes.length;
	var sameWay = t.notes.every(function(c) { return mean < 0 ? c < 0 : c > 0; });
	if (sameWay && Math.abs(mean) >= TUNING_BIAS_CENTS) showTuningTip(mean > 0);
}

// What to try, per instrument: first the instrument's tuning, then the
// embouchure. null for instruments that can't be tuned (bells).
function tuningTip(instrument, sharp) {
	if (instrument === "flute") return sharp
		? ["Pull your head joint out a tiny bit.", "Aim your air a little lower, and don’t roll the flute out."]
		: ["Push your head joint in a tiny bit.", "Aim your air across the hole, and don’t roll the flute in toward you."];
	if (/sax$/.test(instrument)) return sharp
		? ["Pull your mouthpiece out a tiny bit on the cork. Twist it gently as you move it.", "Don’t bite the reed: relax your jaw a little."]
		: ["Push your mouthpiece a little farther onto the cork. Twist it gently as you move it.", "Keep the corners of your mouth firm, and don’t let your jaw drop."];
	if (/clarinet$/.test(instrument)) return sharp
		? ["Don’t bite the reed: relax your jaw a little.", "Still high? Pull your barrel out a tiny bit."]
		: ["Firm up the corners of your mouth and keep your chin flat.", "Blow fast, steady air. If your barrel is pulled out, push it back in."];
	if (instrument === "oboe" || instrument === "bassoon") return sharp
		? ["Don’t bite the reed: relax your lips a little.", "Try a little less reed in your mouth."]
		: ["Firm up the corners of your lips around the reed.", "Try a little more reed in your mouth, and use fast air."];
	if (instrument === "trombone") return sharp
		? ["Pull your tuning slide (on the bell section, behind your head) out a tiny bit.", "Relax your lips, and don’t press the mouthpiece too hard."]
		: ["Push your tuning slide (on the bell section, behind your head) in a tiny bit.", "Firm up the corners of your mouth and use fast air."];
	if (/^(trumpet|horn|euphonium|tuba)$/.test(instrument)) return sharp
		? ["Pull your main tuning slide out a tiny bit.", "Relax your lips, and don’t press the mouthpiece too hard."]
		: ["Push your main tuning slide in a tiny bit.", "Firm up the corners of your mouth and use fast air."];
	return null;
}

function tuningTipOpen() {
	var card = document.getElementById("tuning-tip");
	return !!card && !card.hidden;
}

// The tip card: the mic is ignored while it's up (the student is busy
// adjusting), and closing it starts the note's hold over
function showTuningTip(sharp) {
	var t = practice.tuning;
	var now = performance.now();
	var lines = tuningTip(practice.instrument, sharp);
	var card = document.getElementById("tuning-tip");
	var levelUp = document.getElementById("level-up");
	if (!lines || !card || !practiceOpen || now - t.tipAt < TUNING_TIP_COOLDOWN_MS
		|| (levelUp && !levelUp.hidden)) return;
	t.tipAt = now;
	t.notes = [];
	card.querySelector(".tuning-tip-title").textContent = sharp
		? "Your notes are a little high" : "Your notes are a little low";
	var list = card.querySelector(".tuning-tip-list");
	list.innerHTML = "";
	lines.forEach(function(line) {
		var li = document.createElement("li");
		li.textContent = line;
		list.appendChild(li);
	});
	card.setAttribute("data-dir", sharp ? "high" : "low");
	card.hidden = false;
	card.querySelector("button").focus();
}

function closeTuningTip() {
	var card = document.getElementById("tuning-tip");
	if (!card || card.hidden) return;
	card.hidden = true;
	if (practice) {
		practice.tuning.sum = practice.tuning.ms = practice.tuning.lowMs = practice.tuning.highMs = 0;
		practice.holdMs = 0;
		practice.centsTotal = 0;
		practice.lastFrame = null;
	}
}

function finishPracticeNote(inTune) {
	var lesson = currentLesson();
	var earned = [practice.firstTry, true, inTune];
	var count = earned.filter(Boolean).length;
	var wasComplete = allNotesLearned();
	practice.earned = earned;
	practice.newBest = count > lesson.stars[practice.index];
	lesson.stars[practice.index] = Math.max(lesson.stars[practice.index], count);
	savePracticeStars(practice.instrument, lesson.stars, lesson.storage);
	practice.allLearned = !wasComplete && allNotesLearned();
	renderPracticeMap();
	goToPracticeStep(4);
	launchFireworks(document.getElementById("practice-stage"));
	recordProgress(10 + 5 * count + (practice.newBest ? NEW_BEST_XP : 0));
}

function renderPracticeResult() {
	var name = practiceNoteName(practice.target);
	var scale = practice.lesson === "scale" || practice.lesson === "scaleChromatic";
	var next4 = practice.lesson === "next4";
	var first3 = practice.lesson.indexOf("first3") === 0;
	var more = moreScale(practice.lesson);
	var prompt = document.getElementById("practice-prompt");
	var body = document.getElementById("practice-body");
	prompt.textContent = !practice.allLearned ? "You played " + name + "!"
		: more ? "You learned the whole concert " + more.name + " scale!"
		: scale ? "You learned the whole " + scaleName(practice.lesson) + " scale!"
		: first3 ? "You learned your first 3 notes!"
		: next4 ? "You learned notes 6 and beyond!"
		: "You learned all five notes!";

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
	var nextIndex = (practice.index + 1) % currentLesson().notes.length;
	actions.appendChild(practiceButton("Next note \u2192", practice.allLearned ? "secondary" : "primary", function() {
		startPracticeNote(nextIndex);
	}));
	// The whole lesson learned: on to the next step of the path, or else
	// what follows the lesson
	var learned = currentLesson().stars.every(function(n) { return n > 0; });
	if (!(learned && addPathNextButton(actions)) && practice.allLearned) {
		var set = practice.lesson;
		actions.appendChild(scale || more ? practiceButton("Play the whole scale \u2192", "primary", function() { startScaleRun(set); })
			: first3 ? practiceButton("Name the notes \u2192", "primary", function() { startDrill(threeSetActivity("names3", practice.lesson)); })
			: next4 ? practiceButton("Take the 9 note quiz \u2192", "primary", startNineQuiz)
			: practiceButton("Take the quiz \u2192", "primary", startChallenge));
	}
	body.appendChild(actions);
}

// The lesson's notes across the top. A note's name stays hidden (a number
// shows instead) until it's been learned, so the map never answers the Read step.
function renderPracticeMap() {
	var map = document.getElementById("practice-map");
	var lesson = currentLesson();
	map.innerHTML = "";
	map.setAttribute("data-count", lesson.notes.length);
	map.style.gridTemplateColumns = "repeat(" + lesson.notes.length + ", minmax(0, 1fr))";
	lesson.notes.forEach(function(midi, i) {
		var stars = lesson.stars[i];
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
// Notes climbing a staircase, for the scale lessons
var SCALE_SVG = '<svg width="30" height="26" viewBox="0 0 30 26" fill="currentColor" aria-hidden="true">' +
	'<ellipse cx="4" cy="21" rx="3.4" ry="2.6"/><ellipse cx="11.3" cy="15.3" rx="3.4" ry="2.6"/>' +
	'<ellipse cx="18.6" cy="9.6" rx="3.4" ry="2.6"/><ellipse cx="26" cy="4" rx="3.4" ry="2.6"/></svg>';
// Notes going up and back down, for the scale run
var SCALE_RUN_SVG = '<svg width="34" height="26" viewBox="0 0 34 26" fill="currentColor" aria-hidden="true">' +
	'<ellipse cx="4" cy="21" rx="3.2" ry="2.5"/><ellipse cx="10.5" cy="12.5" rx="3.2" ry="2.5"/>' +
	'<ellipse cx="17" cy="4" rx="3.2" ry="2.5"/><ellipse cx="23.5" cy="12.5" rx="3.2" ry="2.5"/>' +
	'<ellipse cx="30" cy="21" rx="3.2" ry="2.5"/></svg>';

// Read / Finger / Hear / Play chips. Steps already reached can be revisited.
function renderPracticeSteps() {
	if (practice.mode === "drill") {
		renderDrillProgress();
		return;
	}
	if (practice.mode === "challenge") {
		renderChallengeProgress();
		return;
	}
	if (practice.mode === "firstsounds") {
		renderFirstSoundsSteps();
		return;
	}
	if (practice.mode === "song") {
		renderSongProgress();
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

// Indexes of count notes (default the first five), length long (default
// CHALLENGE_LENGTH): every note at least once (shuffled passes), never the
// same note twice in a row
function makeChallengeSequence(count, length) {
	count = count || 5;
	length = length || CHALLENGE_LENGTH;
	function shuffled() {
		var a = [];
		for (var n = 0; n < count; n++) a.push(n);
		for (var i = a.length - 1; i > 0; i--) {
			var j = Math.floor(Math.random() * (i + 1));
			var t = a[i]; a[i] = a[j]; a[j] = t;
		}
		return a;
	}
	var seq = [];
	while (seq.length < length) {
		var pass = shuffled();
		if (seq.length && pass[0] === seq[seq.length - 1]) {
			pass.push(pass.shift());
		}
		seq = seq.concat(pass);
	}
	return seq.slice(0, length);
}

function startChallenge() {
	clearTimeout(practiceAdvanceTimer);
	setPracticeMode("challenge");
	practice.index = -1;
	practice.challenge = { kind: "quiz", notes: practice.notes, seq: makeChallengeSequence(), pos: 0, results: [] };
	showChallengeNote();
}

// The 9 note quiz: the quiz over the first five notes and notes 6 and beyond
function startNineQuiz() {
	clearTimeout(practiceAdvanceTimer);
	setPracticeMode("challenge");
	practice.index = -1;
	var notes = practice.notes.concat(practice.lessons.next4.notes);
	practice.challenge = { kind: "quiz9", notes: notes, seq: makeChallengeSequence(notes.length, QUIZ9_LENGTH), pos: 0, results: [] };
	showChallengeNote();
}

// The 3 note quiz: the quiz over a set of first 3 notes (D C B\u266d, or
// B A G on flute and oboe)
function startThreeQuiz(set) {
	set = set || practice.threeSet;
	practice.threeSet = set;
	clearTimeout(practiceAdvanceTimer);
	setPracticeMode("challenge");
	practice.index = -1;
	var notes = threeNotes(set);
	practice.challenge = { kind: "quiz3", set: set, notes: notes, seq: makeChallengeSequence(notes.length, QUIZ3_LENGTH), pos: 0, results: [] };
	showChallengeNote();
}

// A scale run's order (default the B♭ scale's): note indexes up the octave
// and back down
function scaleRunSequence(set) {
	var up = LESSON_SETS[set || "scale"].steps.map(function(s, i) { return i; });
	return up.concat(up.slice(0, -1).reverse());
}

// Play the B♭ scale (or set, one of MORE_SCALES): a challenge round over
// the scale's notes in order
function startScaleRun(set) {
	set = set || "scale";
	clearTimeout(practiceAdvanceTimer);
	setPracticeMode("challenge");
	practice.index = -1;
	var lesson = practice.lessons[set];
	practice.challenge = { kind: "scale", set: set, notes: lesson.notes, spellings: lesson.spellings,
		seq: scaleRunSequence(set), pos: 0, results: [] };
	showChallengeNote();
}

function showChallengeNote() {
	var c = practice.challenge;
	clearTimeout(practiceAdvanceTimer);
	stopNote();
	practice.target = c.notes[c.seq[c.pos]];
	c.helped = false;
	c.revealed = false;
	resetPracticeHold();

	document.getElementById("practice-view").setAttribute("data-step", "challenge");
	drawPracticeStaff(practice.target);
	renderPracticeSteps();
	if (c.kind !== "scale") {
		showChallengeName();
		return;
	}
	var top = c.notes.length - 1;
	document.getElementById("practice-prompt").textContent = c.pos === 0 ? "Start the scale on this note!"
		: c.pos < top ? "Next note up!"
		: c.pos === top ? "Up to the top!"
		: "Now back down!";
	showChallengePlay();
}

// The quiz asks the note's name first (no mic scoring yet); a wrong name
// still has to be fixed, and the note then no longer scores
function showChallengeName() {
	var c = practice.challenge;
	c.phase = "name";
	practice.step = -1;
	document.getElementById("practice-prompt").textContent = "What\u2019s the name of this note?";
	var body = document.getElementById("practice-body");
	body.innerHTML = "";
	var answers = document.createElement("div");
	answers.className = "practice-answers";
	// One button per name, low to high (the high and low A♭ share one)
	var names = {};
	var choices = c.notes.slice().sort(function(a, b) { return a - b; }).filter(function(midi) {
		var name = practiceNoteName(midi);
		if (names[name]) return false;
		names[name] = true;
		return true;
	});
	if (c.kind === "quiz" || c.kind === "quiz3") choices = c.notes;
	answers.setAttribute("data-count", choices.length);
	choices.forEach(function(midi) {
		var b = document.createElement("button");
		b.className = "practice-answer";
		b.textContent = practiceNoteName(midi);
		b.onclick = function() { answerChallengeName(b, midi); };
		answers.appendChild(b);
	});
	body.appendChild(answers);
	var help = practiceButton("Help", "secondary", showChallengeHelp);
	help.id = "challenge-help-button";
	body.appendChild(help);
}

function answerChallengeName(button, midi) {
	var c = practice.challenge;
	if (c.phase !== "name") return;
	var prompt = document.getElementById("practice-prompt");
	if ((((midi - practice.target) % 12) + 12) % 12 !== 0) {
		c.helped = true;
		button.classList.remove("wrong");
		void button.offsetWidth;  // restart the shake
		button.classList.add("wrong");
		button.disabled = true;
		prompt.textContent = "Not that one \u2014 try again!";
		renderPracticeSteps();
		return;
	}
	c.phase = "named";
	button.classList.add("right");
	prompt.textContent = praiseWord() + " That\u2019s " + practiceNoteName(practice.target) + ".";
	// Just the bounce and chime: the balloons wait for it to be played
	celebrateCorrect(button, true);
	practiceAdvanceTimer = setTimeout(function() {
		document.getElementById("practice-prompt").textContent = "Now play " + practiceNoteName(practice.target) + "!";
		showChallengePlay();
	}, 900);
}

// The note's turn to be played: the hold bar, Help (until it's been used),
// and the mic
function showChallengePlay() {
	var c = practice.challenge;
	clearTimeout(practiceAdvanceTimer);
	c.phase = "play";
	practice.step = 3;
	resetPracticeHold();
	// The chime after a right name mustn't count as the student playing
	practice.ignoreUntil = performance.now() + 600;
	var body = document.getElementById("practice-body");
	body.innerHTML =
		'<div class="practice-feedback" id="practice-feedback" aria-live="polite">Get ready\u2026</div>' +
		'<div class="practice-feedback-sub" id="practice-feedback-sub">&nbsp;</div>' +
		'<div class="practice-hold" aria-hidden="true"><div class="practice-hold-fill" id="practice-hold-fill"></div></div>';
	if (!c.revealed) {
		var help = practiceButton("Help", "secondary", showChallengeHelp);
		help.id = "challenge-help-button";
		body.appendChild(help);
	}

	if (!listenActive) {
		practiceStartedMic = true;
		startListening();
	}
	setPracticeFeedback(c.kind === "scale" ? "Hold it until the bar fills"
		: "Play " + practiceNoteName(practice.target) + " and hold it", "\u00a0");
}

// Reveal the name (big), fingering (big) and sound. The note still has to
// be played, but it no longer scores. In the quiz's name step this answers
// the name too and moves on to playing.
function showChallengeHelp() {
	var c = practice.challenge;
	if (c.phase !== "play") showChallengePlay();
	c.helped = true;
	c.revealed = true;
	renderPracticeSteps();
	var name = practiceNoteName(practice.target);
	document.getElementById("practice-view").setAttribute("data-step", "challenge-help");
	var prompt = document.getElementById("practice-prompt");
	prompt.innerHTML = '<span class="challenge-help-this">This is</span> <span class="challenge-help-name"></span>';
	prompt.lastChild.textContent = name;

	var body = document.getElementById("practice-body");
	var help = document.getElementById("challenge-help-button");
	if (help) help.remove();
	body.insertBefore(practiceFingeringBox(), body.firstChild);
	var hear = practiceButton("\u25b6 Hear it", "secondary", playPracticeExample);
	body.appendChild(hear);
	setPracticeFeedback("Play " + name + " and hold it", "\u00a0");
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
		if (c.pos < c.seq.length) {
			showChallengeNote();
		} else {
			finishChallenge();
		}
	}, 900);
}

function finishChallenge() {
	if (practice.challenge.kind === "scale") {
		finishScaleRun();
		return;
	}
	if (practice.challenge.kind === "quiz9") {
		finishNineQuiz();
		return;
	}
	if (practice.challenge.kind === "quiz3") {
		finishThreeQuiz();
		return;
	}
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
	recordProgress(10 + 3 * score + (newBest && score > 0 ? NEW_BEST_XP : 0));
}

function finishNineQuiz() {
	var score = practice.challenge.results.filter(Boolean).length;
	var newBest = practice.quiz9Best === null || score > practice.quiz9Best;
	if (newBest) {
		practice.quiz9Best = score;
		saveChallengeBest(practice.instrument, score, QUIZ9_STORAGE_KEY);
	}
	showRoundResult(score, newBest,
		score === QUIZ9_LENGTH ? "Perfect! You know all nine notes!" : "Quiz complete!",
		"You played " + score + " of " + QUIZ9_LENGTH + " on your own",
		startNineQuiz, QUIZ9_LENGTH);
	recordProgress(10 + 3 * score + (newBest && score > 0 ? NEW_BEST_XP : 0));
}

function finishThreeQuiz() {
	var set = practice.challenge.set;
	var score = practice.challenge.results.filter(Boolean).length;
	var best = practice.quiz3Best[set];
	var newBest = best === null || score > best;
	if (newBest) {
		practice.quiz3Best[set] = score;
		saveChallengeBest(practice.instrument, score, QUIZ3_STORAGE_KEYS[set]);
	}
	showRoundResult(score, newBest,
		score === QUIZ3_LENGTH ? "Perfect! You know " + threeNotesText(set) + "!" : "Quiz complete!",
		"You played " + score + " of " + QUIZ3_LENGTH + " on your own",
		function() { startThreeQuiz(set); }, QUIZ3_LENGTH);
	recordProgress(10 + 3 * score + (newBest && score > 0 ? NEW_BEST_XP : 0));
}

function finishScaleRun() {
	var c = practice.challenge;
	var score = c.results.filter(Boolean).length;
	var best = practice.scaleRunBest[c.set];
	var newBest = best === null || score > best;
	if (newBest) {
		practice.scaleRunBest[c.set] = score;
		saveChallengeBest(practice.instrument, score, SCALE_RUN_STORAGE_KEYS[c.set]);
	}
	showRoundResult(score, newBest,
		score === c.seq.length ? "Perfect! You played the whole " + scaleName(c.set) + " scale!" : "Scale complete!",
		"You played " + score + " of " + c.seq.length + " on your own",
		function() { startScaleRun(c.set); }, c.seq.length);
	recordProgress(10 + 3 * score + (newBest && score > 0 ? NEW_BEST_XP : 0));
}

// End of a quiz, scale run, drill round or song: trophy, stars, score line,
// what's next. total defaults to CHALLENGE_LENGTH; back (optional
// { label, onclick }) replaces the Back to the menu button.
function showRoundResult(score, newBest, title, scoreText, again, total, back) {
	stopNote();
	var stars = challengeStars(score, total);
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
	actions.appendChild(back ? practiceButton(back.label, "secondary", back.onclick)
		: practiceButton("Back to the menu", "secondary", showPracticeMenu));
	actions.appendChild(practiceButton("Play again", "primary", again));
	// Done well: straight on to the next step (a song's result adds its own)
	if (stars > 0 && !back) addPathNextButton(actions);
	body.appendChild(actions);

	if (stars > 0) launchFireworks(document.getElementById("practice-stage"));
}

// One dot per note of the round in place of the step chips: green = played on your own, yellow =
// played with help, ringed = the current note
function renderChallengeProgress() {
	var c = practice.challenge;
	var list = document.getElementById("practice-steps");
	list.innerHTML = "";
	var row = document.createElement("div");
	row.className = "challenge-progress";
	row.setAttribute("role", "img");
	var length = c.seq.length;
	row.setAttribute("aria-label", "Note " + Math.min(c.pos + 1, length) + " of " + length);
	for (var i = 0; i < length; i++) {
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

// A race against the clock: name as many notes as you can in DRILL_SECONDS.
// kind "names" shows the note on the staff; "fingerings" shows only its chart
// (or unlabeled piano key). "names3" and "fingerings3" do the same on the
// first 3 notes (D C B♭; "names3bag" / "fingerings3bag" on B A G), "names9" / "fingerings9" on the first 5
// and notes 6 and beyond, "namesscale" / "fingeringsscale" on the B♭ scale
// ("namesscaleEb"... on MORE_SCALES, spelled in their key). Either way the student picks its name; a note
// scores if named on the first try (a wrong answer still has to be fixed
// before moving on). The clock starts once the first answers can be tapped.
// Shares the challenge's result screen.
function startDrill(kind) {
	clearTimeout(practiceAdvanceTimer);
	stopNote();
	setPracticeMode("drill");
	practice.drillKind = kind;
	if (isThreeDrill(kind)) practice.threeSet = /bag$/.test(kind) ? "first3bag" : "first3";
	practice.drillNotes = drillNotes(kind);
	practice.index = -1;
	var scale = scaleSetOf(kind);
	practice.challenge = { kind: "drill", notes: practice.drillNotes, seq: [], pos: 0, results: [], score: 0, endsAt: 0,
		balloonGoal: drillBalloonGoal(kind), spellings: scale ? practice.lessons[scale].spellings : null };
	document.getElementById("practice-steps").innerHTML = "";
	var balloon = document.getElementById("drill-balloon");
	if (balloon) balloon.remove();
	showDrillQuestion();
}

// The notes a drill kind asks: the first 3, the first 5, those plus notes 6
// and beyond ("9"), or a scale ("scale", "scaleEb"...)
function drillNotes(kind) {
	if (isThreeDrill(kind)) return threeNotes(/bag$/.test(kind) ? "first3bag" : "first3");
	if (/9$/.test(kind)) return practice.notes.concat(practice.lessons.next4.notes);
	if (scaleSetOf(kind)) return practice.lessons[scaleSetOf(kind)].notes;
	return practice.notes;
}

function isThreeDrill(kind) {
	return /^(names|fingerings)3(bag)?$/.test(kind);
}


// A random note index for the next question, never the same twice in a row
function nextDrillNote(seq) {
	var count = practice.drillNotes.length;
	var last = seq.length ? seq[seq.length - 1] : -1;
	var i = Math.floor(Math.random() * (count - (last < 0 ? 0 : 1)));
	return last >= 0 && i >= last ? i + 1 : i;
}

// Start the round's clock (once); it ends the round when it runs out
function startDrillClock(c) {
	if (c.endsAt) return;
	c.endsAt = Date.now() + DRILL_SECONDS * 1000;
	clearInterval(drillClockTimer);
	drillClockTimer = setInterval(function() {
		if (practice.challenge !== c || practice.mode !== "drill") {
			clearInterval(drillClockTimer);
			return;
		}
		if (Date.now() >= c.endsAt) {
			finishDrill();
		} else {
			renderDrillProgress();
		}
	}, 100);
	renderDrillProgress();
}

// Right answers needed to pop the balloon: DRILL_BALLOON_GOAL, and once the
// student has popped it, one more than their best
function drillBalloonGoal(kind) {
	var best = practice.drillBest[kind];
	return typeof best === "number" && best >= DRILL_BALLOON_GOAL ? best + 1 : DRILL_BALLOON_GOAL;
}

// A big balloon beside the question, inflating with each right answer until
// it pops; the number on it is the goal
var DRILL_BALLOON_SVG = '<svg viewBox="0 0 40 58" aria-hidden="true">' +
	'<path d="M20 47 Q17 52 21 55 T19 58" fill="none" stroke="#8a80a3" stroke-width="1.5"/>' +
	'<ellipse cx="20" cy="22" rx="18" ry="21.5" fill="#ff4d6d"/>' +
	'<ellipse cx="13" cy="13" rx="4" ry="7" fill="#fff" opacity="0.45" transform="rotate(-20 13 13)"/>' +
	'<path d="M17 42.5 L23 42.5 L21.5 47 L18.5 47 Z" fill="#ff4d6d"/>' +
	'<text class="drill-balloon-goal" x="20" y="28.5" text-anchor="middle"></text></svg>';

// The clock bar draining from full, the seconds left and the score so far
// (gold once it beats the best), in place of the step chips; and the balloon
// in its column at the side of the card
function renderDrillProgress() {
	var c = practice.challenge;
	var list = document.getElementById("practice-steps");
	var row = list.querySelector(".drill-progress");
	if (!row) {
		list.innerHTML = "";
		row = document.createElement("div");
		row.className = "drill-progress";
		row.innerHTML = '<span class="drill-time"></span>' +
			'<span class="drill-clock"><span class="drill-clock-fill"></span></span>' +
			'<span class="drill-score"></span>';
		list.appendChild(row);
	}
	var left = c.endsAt ? Math.max(0, c.endsAt - Date.now()) : DRILL_SECONDS * 1000;
	var secs = Math.ceil(left / 1000);
	var time = row.querySelector(".drill-time");
	time.textContent = "0:" + (secs < 10 ? "0" : "") + secs;
	time.setAttribute("aria-label", secs + " seconds left");
	row.querySelector(".drill-clock-fill").style.width = (left / (DRILL_SECONDS * 1000) * 100) + "%";
	row.classList.toggle("hurry", !!c.endsAt && secs <= 5);
	var best = practice.drillBest[practice.drillKind];
	var score = row.querySelector(".drill-score");
	score.textContent = "\u2713 " + c.score;
	score.setAttribute("aria-label", c.score + " right" + (typeof best === "number" ? ", best " + best : ""));
	score.classList.toggle("beat", typeof best === "number" && c.score > best);
	var balloon = document.getElementById("drill-balloon");
	if (!balloon) {
		balloon = document.createElement("div");
		balloon.id = "drill-balloon";
		balloon.className = "drill-balloon";
		balloon.setAttribute("aria-hidden", "true");
		balloon.innerHTML = DRILL_BALLOON_SVG;
		balloon.querySelector(".drill-balloon-goal").textContent = c.balloonGoal;
		document.getElementById("practice-stage").appendChild(balloon);
	}
	balloon.style.setProperty("--fill", Math.min(c.score, c.balloonGoal) / c.balloonGoal);
	balloon.classList.toggle("popped", !!c.popped);
}

// The balloon is full: it bursts into confetti, and the round goes on
function popDrillBalloon() {
	var c = practice.challenge;
	c.popped = true;
	renderDrillProgress();
	playPop();
	var balloon = document.querySelector("#drill-balloon svg");
	if (balloon) launchConfetti(balloon);
}

// Confetti bursting out of an element and fluttering down across the
// practice card (on the balloons' layer, so it's clipped and lets taps
// through). Skipped when the student prefers reduced motion.
function launchConfetti(from) {
	if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	var stage = document.getElementById("practice-stage");
	if (!stage || !from.animate) return;
	var layer = document.getElementById("balloon-layer");
	if (!layer) {
		layer = document.createElement("div");
		layer.id = "balloon-layer";
		layer.className = "balloon-layer";
		layer.setAttribute("aria-hidden", "true");
	}
	if (layer.parentNode !== stage) stage.appendChild(layer);
	var box = stage.getBoundingClientRect();
	var r = from.getBoundingClientRect();
	var x = r.left + r.width / 2 - box.left;
	var y = r.top + r.height / 2 - box.top;
	for (var i = 0; i < 60; i++) {
		var piece = document.createElement("div");
		piece.className = "confetti";
		piece.style.left = x + "px";
		piece.style.top = y + "px";
		piece.style.background = BALLOON_COLORS[i % BALLOON_COLORS.length];
		if (Math.random() < 0.3) piece.style.borderRadius = "50%";
		var angle = Math.random() * Math.PI * 2;
		var burst = 40 + Math.random() * 110;
		var dx = Math.cos(angle) * burst;
		var dy = Math.sin(angle) * burst * 0.7 - 30;
		var fall = box.height * (0.5 + Math.random() * 0.5);
		var spin = (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 540);
		var anim = piece.animate([
			{ transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
			{ transform: "translate(" + dx + "px, " + dy + "px) rotate(" + spin * 0.3 + "deg)", opacity: 1, offset: 0.2 },
			{ transform: "translate(" + dx * 1.4 + "px, " + (dy + fall) + "px) rotate(" + spin + "deg)", opacity: 0 }
		], { duration: 1600 + Math.random() * 900, easing: "cubic-bezier(.2,.6,.4,1)", fill: "forwards" });
		layer.appendChild(piece);
		anim.onfinish = (function(p) { return function() { p.remove(); }; })(piece);
	}
}

// One key per drill note, equal when two notes share a fingering (trumpet
// C and G are both open; trombone B♭ and F are both 1st position). Valve and
// clarinet keys come from the fingering data; image charts are fingerprinted
// by their file contents, since notes sharing a fingering share an identical
// chart. Without charts (piano), every note is distinct. Calls back with the
// keys; anything unreadable gets a unique key, so it is never hidden.
function loadFingeringKeys(callback) {
	var instrument = practice.instrument;
	var notes = practice.drillNotes;
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

// The answer choices for the current question: one per note name, low to
// high (an octave's two notes share one), except in the fingerings drills,
// where other notes sharing the target's fingering are left out so only one
// answer is right. The first 3 and 5 notes keep their teaching order.
function drillChoices() {
	var notes = practice.drillNotes;
	var keys = practice.fingeringKeys[notes.join(",")];
	var targetKey = keys && keys[notes.indexOf(practice.target)];
	var choices = notes.filter(function(midi, i) {
		return isDrillNames() || !keys || sameNoteName(midi, practice.target) || keys[i] !== targetKey;
	});
	if (notes.length <= 5) return choices;
	var seen = {};
	return choices.slice().sort(function(a, b) { return a - b; }).filter(function(midi) {
		var name = practiceNoteName(midi);
		if (seen[name]) return false;
		seen[name] = true;
		return true;
	});
}

// Whether two notes are the same note name (an octave apart or not)
function sameNoteName(a, b) {
	return (((a - b) % 12) + 12) % 12 === 0;
}

function isDrillNames() {
	return /^names/.test(practice.drillKind);
}

function showDrillQuestion() {
	var c = practice.challenge;
	clearTimeout(practiceAdvanceTimer);
	var pos = c.pos;
	if (c.seq.length <= pos) c.seq.push(nextDrillNote(c.seq));
	practice.target = practice.drillNotes[c.seq[pos]];
	practice.step = -1;  // no mic scoring
	c.helped = false;    // set by a wrong answer
	c.answered = false;

	var names = isDrillNames();
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
	// question by the time they load). The clock waits for the answers.
	var answers = drillAnswers();
	body.appendChild(answers);
	var keysFor = practice.drillNotes.join(",");
	if (!names && !practice.fingeringKeys[keysFor]) {
		var state = practice;
		answers.querySelectorAll("button").forEach(function(b) { b.disabled = true; });
		loadFingeringKeys(function(keys) {
			state.fingeringKeys[keysFor] = keys;
			if (practice === state && state.challenge === c && c.pos === pos && state.mode === "drill" && answers.parentNode) {
				answers.parentNode.replaceChild(drillAnswers(), answers);
				startDrillClock(c);
			}
		});
	} else {
		startDrillClock(c);
	}
}

// The answer buttons for the current drill question
function drillAnswers() {
	var answers = document.createElement("div");
	answers.className = "practice-answers";
	var choices = drillChoices();
	answers.setAttribute("data-count", choices.length);
	if (choices.length <= 5) answers.style.gridTemplateColumns = "repeat(" + choices.length + ", minmax(0, 80px))";
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
	if (c.answered || !c.endsAt || Date.now() >= c.endsAt) return;
	var prompt = document.getElementById("practice-prompt");
	if (!sameNoteName(midi, practice.target)) {
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
	if (!c.helped) c.score++;
	c.streak = c.helped ? 0 : (c.streak || 0) + 1;
	button.classList.add("right");
	prompt.textContent = praiseWord() + " That\u2019s " + practiceNoteName(practice.target) + "." + streakText(c.streak);
	renderPracticeSteps();
	if (c.score === c.balloonGoal && !c.popped) {
		popDrillBalloon();
		prompt.textContent = c.balloonGoal > DRILL_BALLOON_GOAL ? "Pop! A new best! Keep going!"
			: "Pop! " + c.balloonGoal + " right! Keep going!";
	}
	// No balloons mid-round (they'd distract from the race); they come at the end
	celebrateCorrect(button, true);
	// Quick, so the clock is spent naming notes (it keeps running meanwhile)
	practiceAdvanceTimer = setTimeout(function() {
		c.pos++;
		showDrillQuestion();
	}, DRILL_NEXT_MS);
}

// Time's up: the score is the notes named right on the first try
function finishDrill() {
	clearInterval(drillClockTimer);
	clearTimeout(practiceAdvanceTimer);
	var kind = practice.drillKind;
	var score = practice.challenge.score;
	var prev = practice.drillBest[kind];
	var newBest = typeof prev !== "number" || score > prev;
	if (newBest) {
		practice.drillBest[kind] = score;
		saveDrillBest(practice.instrument, practice.drillBest);
	}
	var line = "You named " + score + " note" + (score === 1 ? "" : "s") + " in " + DRILL_SECONDS + " seconds";
	if (!newBest) line += score === prev ? " \u2014 that ties your best" : " \u2014 your best is " + prev;
	showRoundResult(score, newBest,
		newBest && typeof prev === "number" && score > 0 ? "You beat your best!" : "Time\u2019s up!",
		line,
		function() { startDrill(kind); }, DRILL_STAR_GOAL);
	if (score > 0) launchBalloons();
	recordProgress(5 + 2 * score + (newBest && score > 0 ? NEW_BEST_XP : 0));
}

// ---------------------------------------------------------------------------
// Songs: real tunes made of the first five notes, played note by note from
// the staff. The rhythm is shown but not judged; a repeated note has to be
// tongued again (a dip in loudness or a break) before it counts.
// ---------------------------------------------------------------------------

var SONGS_STORAGE_KEY = "pitchdetect-songs";
var SONG_HOLD_MS = 300;            // short, so the tune keeps moving
var SONG_TEMPO = 100;              // quarter notes per minute for Hear the song
var SONG_RETONGUE_DIP = 0.75;      // loudness this far below the note = re-tongued
// Measures on a line of a song: 4 on a wide screen, where the song's card
// widens (index.html), else 2; the editor keeps 2, big enough to tap
var WIDE_SONG_QUERY = window.matchMedia("(min-width: 1000px)");
var SONG_MEASURES_PER_LINE = WIDE_SONG_QUERY.matches ? 4 : 2;
var EDITOR_MEASURES_PER_LINE = 2;
// Play it through: the mic follows along without waiting on each note
var FOLLOW_NOTE_MS = 100;          // a steady pitch this long counts as a note played
var FOLLOW_GAP_MS = 60;            // silence this long ends a note
var FOLLOW_END_SILENCE_MS = 5000;  // quiet this long after starting ends the run
var FOLLOW_SAME_NOTE = 0.5;        // semitones from a note's pitch so far that are still that note
var HEARD_CLOSE_CENTS = 75;        // this near a note (past PRACTICE_PASS_CENTS + 15): it, out of tune
var SONG_MEASURE_WIDTH = 170;      // staff units per measure
var SONG_BEATS = { w: 4, h: 2, q: 1, "8": 0.5 };  // in quarter notes
var MY_SONGS_STORAGE_KEY = "pitchdetect-my-songs";

// Each measure lists notes as scale degree plus duration (w, h, q, 8), with
// a trailing "." for a dotted note; "r" in place of the degree is a rest.
// Degrees 1–5 are the first five notes (B♭ C D E♭ F concert), 6–8 the rest
// of the B♭ scale (G A B♭). An optional time signature is shown (default
// 4/4, not shown). Each song has a level (SONG_LEVELS): 3-note songs use
// only degrees 1–3, which are the student's first 3 notes from the bottom
// (B♭ C D, or G A B on flute and oboe starting on B A G, threeNoteScale());
// beginner songs stay on the first five notes in plain rhythms;
// intermediate adds rests, dotted notes or notes past the fifth; advanced,
// eighth notes on the whole scale.
// A song with steps (concert semitones from the first B♭, one letter apart,
// so spellScale() spells them) numbers its notes 1–8 from those instead:
// the "beyond" songs, on the notes 6 and beyond. tonic (an index into
// steps) adds " in <key>" to the title, named at the student's written pitch.
var BEYOND_AB_STEPS = [-2, 0, 2, 4, 5, 7, 9, 10];  // low A♭ B♭ C D E♭ F G A♭
var BEYOND_A_STEPS = [-1, 0, 2, 4, 5, 7, 9, 10];   // low A B♭ C D E♭ F G A♭
// A song with scale (a scale's lesson set: "scale", "scaleEb"...) numbers
// its notes 1–8 up that scale, as its lesson plays it on this instrument,
// and its title names the scale ("Joy to the World (E♭ scale)"): the scale
// songs, one tune in every key the student learns.
// Joy to the World (Lowell Mason, 1839) runs down the whole scale
var JOY_TO_THE_WORLD = ["8h 7q. 68", "5h. 4q", "3h 2h", "1h. 5q",
	"6h. 6q", "7h. 7q", "8h. 8q", "8q 7q 6q 5q",
	"5q. 48 3q 8q", "8q 7q 6q 5q", "5q. 48 3q 3q", "3q 3q 3q 38 48",
	"5h. 48 38", "2q 2q 2q 28 38", "4h. 38 28", "1q 8h 6q",
	"5q. 48 3q 4q", "3h 2h", "1w"];
var SONGS = [
	{ id: "hotcrossbuns", level: "three", title: "Hot Cross Buns",
		measures: ["3h 2h", "1w", "3h 2h", "1w", "1q 1q 1q 1q", "2q 2q 2q 2q", "3h 2h", "1w"] },
	{ id: "merrily", level: "three", title: "Merrily We Roll Along",
		measures: ["3q 2q 1q 2q", "3q 3q 3h", "2q 2q 2h", "3q 3q 3h",
			"3q 2q 1q 2q", "3q 3q 3q 3q", "2q 2q 3q 2q", "1w"] },
	{ id: "steppingstones", level: "three", title: "Stepping Stones",
		measures: ["1h 2h", "3w", "3h 2h", "1w", "1q 2q 3h", "3q 2q 1h", "2q 2q 3q 2q", "1w"] },
	{ id: "upanddown", level: "three", title: "Up and Down",
		measures: ["1q 2q 3q 2q", "1q 2q 3h", "3q 2q 1q 2q", "3q 2q 1h",
			"1q 1q 2q 2q", "3q 3q 2h", "3q 3q 2q 2q", "1w"] },
	{ id: "auclair", level: "three", title: "Au Clair de la Lune",
		measures: ["1q 1q 1q 2q", "3h 2h", "1q 3q 2q 2q", "1w"] },
	{ id: "mary", level: "beginner", title: "Mary Had a Little Lamb",
		measures: ["3q 2q 1q 2q", "3q 3q 3h", "2q 2q 2h", "3q 5q 5h",
			"3q 2q 1q 2q", "3q 3q 3q 3q", "2q 2q 3q 2q", "1w"] },
	{ id: "lightlyrow", level: "beginner", title: "Lightly Row",
		measures: ["5q 3q 3h", "4q 2q 2h", "1q 2q 3q 4q", "5q 5q 5h",
			"5q 3q 3h", "4q 2q 2h", "1q 3q 5q 5q", "1w",
			"2q 2q 2q 2q", "2q 3q 4h", "3q 3q 3q 3q", "3q 4q 5h",
			"5q 3q 3h", "4q 2q 2h", "1q 3q 5q 5q", "1w"] },
	{ id: "odetojoy", level: "beginner", title: "Ode to Joy",
		measures: ["3q 3q 4q 5q", "5q 4q 3q 2q", "1q 1q 2q 3q", "3q 2q 2h",
			"3q 3q 4q 5q", "5q 4q 3q 2q", "1q 1q 2q 3q", "2q 1q 1h"] },
	{ id: "auntrhody", level: "beginner", title: "Go Tell Aunt Rhody",
		measures: ["3h 3q 2q", "1h 1h", "2h 2q 4q", "3q 2q 1h",
			"5h 5q 4q", "3h 3h", "2q 1q 2q 3q", "1w"] },
	{ id: "jinglebells", level: "beginner", title: "Jingle Bells",
		measures: ["3q 3q 3h", "3q 3q 3h", "3q 5q 1q 2q", "3w",
			"4q 4q 4q 4q", "4q 3q 3q 3q", "3q 2q 2q 3q", "2h 5h"] },
	{ id: "hotcrossbunseb", level: "beyond", title: "Hot Cross Buns", steps: BEYOND_AB_STEPS, tonic: 5,
		measures: ["7h 6h", "5w", "7h 6h", "5w", "5q 5q 5q 5q", "6q 6q 6q 6q", "7h 6h", "5w"] },
	{ id: "hotcrossbunsab", level: "beyond", title: "Hot Cross Buns", steps: BEYOND_AB_STEPS, tonic: 1,
		measures: ["3h 2h", "1w", "3h 2h", "1w", "1q 1q 1q 1q", "2q 2q 2q 2q", "3h 2h", "1w"] },
	{ id: "maryab", level: "beyond", title: "Mary Had a Little Lamb", steps: BEYOND_AB_STEPS, tonic: 1,
		measures: ["3q 2q 1q 2q", "3q 3q 3h", "2q 2q 2h", "3q 5q 5h",
			"3q 2q 1q 2q", "3q 3q 3q 3q", "2q 2q 3q 2q", "1w"] },
	{ id: "oldmacdonald", level: "beyond", title: "Old MacDonald", steps: BEYOND_AB_STEPS, tonic: 5,
		measures: ["5q 5q 5q 2q", "3q 3q 2h", "7q 7q 6q 6q", "5h. 2q",
			"5q 5q 5q 2q", "3q 3q 2h", "7q 7q 6q 6q", "5w"] },
	{ id: "yankeedoodle", level: "beyond", title: "Yankee Doodle", steps: BEYOND_AB_STEPS, tonic: 5,
		measures: ["5q 5q 6q 7q", "5q 7q 6q 2q", "5q 5q 6q 7q", "5h 4h",
			"5q 5q 6q 7q", "8q 7q 6q 5q", "4q 2q 3q 4q", "5h 5h"] },
	{ id: "deckthehalls", level: "beyond", title: "Deck the Halls", steps: BEYOND_A_STEPS,
		measures: ["6q. 58 4q 3q", "2q 3q 4q 2q", "38 48 58 38 4q. 38", "2q 1q 2h",
			"6q. 58 4q 3q", "2q 3q 4q 2q", "38 48 58 38 4q. 38", "2q 1q 2h"] },
	{ id: "goinghome", level: "intermediate", title: "Goin\u2019 Home",  // Dvořák, the Largo of the New World Symphony
		measures: ["3q. 58 5h", "3q. 28 1h", "2q 3q 5q 3q", "2w",
			"3q. 58 5h", "3q. 28 1h", "2q 3q 2q. 18", "1w"] },
	{ id: "saints", level: "intermediate", title: "When the Saints",
		measures: ["rq 1q 3q 4q", "5w", "rq 1q 3q 4q", "5w",
			"rq 1q 3q 4q", "5h 3h", "1h 3h", "2w",
			"rq 3q 3q 2q", "1h. 1q", "3h 5h", "4w",
			"rq 1q 3q 4q", "5h 3h", "1h 2h", "1w"] },
	{ id: "twinkle", level: "intermediate", title: "Twinkle, Twinkle",
		measures: ["1q 1q 5q 5q", "6q 6q 5h", "4q 4q 3q 3q", "2q 2q 1h",
			"5q 5q 4q 4q", "3q 3q 2h", "5q 5q 4q 4q", "3q 3q 2h",
			"1q 1q 5q 5q", "6q 6q 5h", "4q 4q 3q 3q", "2q 2q 1h"] },
	{ id: "ducklings", level: "intermediate", title: "All My Little Ducklings",
		measures: ["1q 2q 3q 4q", "5h 5h", "6q 6q 6q 6q", "5w",
			"6q 6q 6q 6q", "5w", "4q 4q 4q 4q", "3h 3h", "2q 2q 2q 2q", "1w"] },
	{ id: "londonbridge", level: "advanced", title: "London Bridge",
		measures: ["5q. 68 5q 4q", "3q 4q 5h", "2q 3q 4h", "3q 4q 5h",
			"5q. 68 5q 4q", "3q 4q 5h", "2h 5h", "3q 1h."] },
	{ id: "michaelrow", level: "advanced", title: "Michael, Row the Boat",
		measures: ["1q 3q 5q. 38", "5q 6q 5h", "3q 5q 6h", "5w",
			"3q 5q 5q. 38", "4q 3q 2h", "1q 2q 3q. 28", "1w"] },
	{ id: "rowyourboat", level: "advanced", title: "Row, Row, Row Your Boat", time: "6/8",
		measures: ["1q. 1q.", "1q 28 3q.", "3q 28 3q 48", "5h.",
			"88 88 88 58 58 58", "38 38 38 18 18 18", "5q 48 3q 28", "1h."] },
	{ id: "thisoldman", level: "advanced", title: "This Old Man",
		measures: ["5q 3q 5h", "5q 3q 5h", "6q 5q 4q 3q", "2q 3q 4q 38 48",
			"5q 1q 18 18 1q", "18 28 38 48 5h", "5q 2q 2q 4q", "3q 2q 1h"] },
	{ id: "joyscale", level: "scales", title: "Joy to the World", scale: "scale", measures: JOY_TO_THE_WORLD },
	{ id: "joyscaleEb", level: "scales", title: "Joy to the World", scale: "scaleEb", measures: JOY_TO_THE_WORLD },
	{ id: "joyscaleAb", level: "scales", title: "Joy to the World", scale: "scaleAb", measures: JOY_TO_THE_WORLD },
	{ id: "joyscaleF", level: "scales", title: "Joy to the World", scale: "scaleF", measures: JOY_TO_THE_WORLD },
	{ id: "joyscaleC", level: "scales", title: "Joy to the World", scale: "scaleC", measures: JOY_TO_THE_WORLD }
];
// More songs on each concert scale after B♭: tunes from above, numbered
// up that scale (scale), so they play in its key at the lesson's octave.
// Each scale gets its own level ("songsEb"...), easiest tune first (they
// keep SONGS' order); ids are the tune's plus the scale's ("odetojoyscaleEb").
// None of these stray below degree 1, where the scale's lesson has no notes.
var SCALE_SONG_TUNES = {
	scaleEb: ["merrily", "odetojoy", "saints", "twinkle", "thisoldman"],
	scaleAb: ["steppingstones", "lightlyrow", "ducklings", "londonbridge", "michaelrow"],
	scaleF: ["hotcrossbuns", "auntrhody", "jinglebells", "goinghome", "rowyourboat"],
	scaleC: ["upanddown", "mary", "odetojoy", "twinkle", "thisoldman"]
};
MORE_SCALES.forEach(function(scale) {
	SONGS.filter(function(song) { return SCALE_SONG_TUNES[scale.id].indexOf(song.id) >= 0; }).forEach(function(song) {
		SONGS.push({ id: song.id + scale.id, level: "songs" + scale.id.slice(5), title: song.title,
			scale: scale.id, time: song.time, measures: song.measures });
	});
});
// The song list's levels, in order, each opening to its songs; each song
// names its level
var SONG_LEVELS = [
	{ id: "three", title: "First 3 notes", sub: "Just three notes" },
	{ id: "beginner", title: "Beginner", sub: "First 5 notes" },
	{ id: "beyond", title: "Notes 6 and beyond", sub: "Songs with your new notes" },
	{ id: "intermediate", title: "Intermediate", sub: "Rests, dots, more notes" },
	{ id: "advanced", title: "Advanced", sub: "Eighth notes, whole scale" },
	{ id: "scales", title: "Scale songs", sub: "Joy to the World in every key" }
];
MORE_SCALES.forEach(function(scale) {
	SONG_LEVELS.push({ id: "songs" + scale.id.slice(5), title: scale.name + " scale songs",
		sub: "Old favorites on the concert " + scale.name + " scale" });
});

var songPlayTimer = null;  // Hear the song playback, see playSong()
// Play along's button names its speed (picked in the song's settings)
function playAlongLabel(speed) {
	return (speed || ALONG_SPEEDS[alongSpeedIndex()]).icon + " Play along";
}
var songLevelsOpen = {};   // song list levels shown open, by level id

// Every note and rest of a song for this instrument, in order:
// [{ midi (null for a rest), dur, dots, measure, letter, alter, octave }]
function songEvents(song) {
	if (song.custom) return customSongEvents(song);
	var events = [];
	var spelled = spellScale(song.level === "three" ? threeNoteScale()
		: song.scale ? practice.lessons[song.scale].notes : practiceNotes(song.steps || SCALE_STEPS));
	song.measures.forEach(function(m, measure) {
		m.split(" ").forEach(function(token) {
			var e = { midi: null, dur: token.charAt(1), dots: token.charAt(2) === "." ? 1 : 0, measure: measure };
			if (token.charAt(0) !== "r") {
				var n = spelled[parseInt(token.charAt(0), 10) - 1];
				e.midi = n.midi;
				e.letter = n.letter;
				e.octave = n.octave;
				e.alter = n.alter;
			}
			events.push(e);
		});
	});
	return events;
}

// Spellings by pitch class ({ 6: "F#" }) of a scale's written notes, up the
// letters from its first note: a lesson on a scale reads like its key
function scaleSpellings(notes) {
	var spellings = {};
	spellScale(notes).forEach(function(n) {
		spellings[((n.midi % 12) + 12) % 12] = "CDEFGAB".charAt(n.letter) + (n.alter > 0 ? "#" : n.alter < 0 ? "b" : "");
	});
	return spellings;
}

// Written notes of a scale (lowest first), spelled up the letters from the
// first note's, so a written scale with a sharp (alto sax: G A B C D E F♯)
// reads right: [{ midi, letter, octave, alter, s (diatonic step) }]
function spellScale(scale) {
	var first = plainPracticeSpelling(scale[0]);
	var firstLetter = "CDEFGAB".indexOf(first.charAt(0));
	var firstOctave = Math.floor((scale[0] - (first.length > 1 ? (first.charAt(1) === "#" ? 1 : -1) : 0)) / 12) - 1;
	return scale.map(function(midi, step) {
		var place = firstLetter + step;
		var n = { midi: midi, letter: place % 7, octave: firstOctave + Math.floor(place / 7) };
		n.alter = midi - (12 * (n.octave + 1) + NATURAL_SEMITONES[n.letter]);
		n.s = n.octave * 7 + n.letter;
		return n;
	});
}

// A song's title; a song in a key ("Hot Cross Buns in E♭") names the key
// at the student's written pitch, a scale song the (concert) scale
function songTitle(song) {
	if (song.scale) return song.title + " (" + scaleName(song.scale) + " scale)";
	if (!song.tonic) return song.title;
	return song.title + " in " + practiceNoteName(practiceNotes(song.steps)[song.tonic - 1]);
}

// The student's first 3 notes from the bottom: 3-note songs' degrees 1–3.
// set: "first3" or "first3bag" (default: the one the student is on)
function threeNoteScale(set) {
	return practice.lessons[set || practice.threeSet].notes.slice().sort(function(a, b) { return a - b; });
}

// The built-in 3-note songs
function threeNoteSongs() {
	return SONGS.filter(function(song) { return song.level === "three"; });
}

// The built-in songs on song list list: "three" (Play 3-note songs),
// "five" (the beginner songs, Play 5-note songs) or "all" (More
// songs: every level but the beginner songs)
function listSongs(list) {
	if (list === "three") return threeNoteSongs();
	return SONGS.filter(function(song) { return (song.level === "beginner") === (list === "five"); });
}

// The student's own songs written with a set of first 3 notes (default:
// the set last opened)
function threeNoteCustomSongs(set) {
	set = set || practice.threeSet;
	return practice.customSongs.filter(function(song) { return song.three === set; });
}

// The student's own songs written with their first 5 notes
function fiveNoteCustomSongs() {
	return practice.customSongs.filter(function(song) { return song.three === "first5"; });
}

// The student's own songs on song list list (see listSongs())
function listCustomSongs(list) {
	return list === "three" ? threeNoteCustomSongs() : list === "five" ? fiveNoteCustomSongs() : practice.customSongs;
}

// Where a song's best is kept: by id, and for 3-note songs on B A G apart
// from the same song on D C B♭ (set: the 3 notes, default the set last opened)
function songBestKey(song, set) {
	return song.level === "three" && (set || practice.threeSet) === "first3bag" ? song.id + "@bag" : song.id;
}

// The notes to play (rests left out), each knowing its place in the events:
// [{ midi, dur, measure, event, ... }]
function songNotes(song, events) {
	return (events || songEvents(song)).map(function(e, i) {
		e.event = i;
		return e;
	}).filter(function(e) { return e.midi !== null && !e.tied; });
}

// A note slurred into the next sounds this long past its end (seconds),
// so it's still sounding however late the next note's timer fires
var LEGATO_OVERLAP = 0.15;

// The first note of the tied notes event i is in (i if it isn't tied on)
function tieStart(events, i) {
	while (i > 0 && events[i].tied && events[i - 1].tie) i--;
	return i;
}

// Ties: a note with tie sounds on through the next (tied), one sound. How
// long event i sounds, in beats, with the notes tied on to it
function tiedBeats(events, i) {
	var beats = eventBeats(events[i]);
	for (var k = i + 1; k < events.length && events[k].tied && events[k - 1].tie; k++) beats += eventBeats(events[k]);
	return beats;
}

// A note or rest's length in quarter notes
function eventBeats(e) {
	return SONG_BEATS[e.dur] * (e.dots ? 1.5 : 1) * (e.tuplet ? 2 / 3 : 1);
}

// "B♭"-style name of a song note as written
function songNoteName(e) {
	return keyDisplayName("CDEFGAB".charAt(e.letter) + (e.alter < 0 ? "b" : e.alter > 0 ? "#" : ""));
}

function findSong(id) {
	return SONGS.concat(practice.customSongs).filter(function(s) { return s.id === id; })[0];
}

// The student's own songs for an instrument (written pitch, so each
// instrument keeps its own): [{ id, title, custom, time, key, notes }]
function loadCustomSongs(instrument) {
	try {
		var songs = JSON.parse(progressGet(MY_SONGS_STORAGE_KEY) || "{}")[instrument];
		if (Array.isArray(songs)) {
			return songs.filter(function(s) { return s && s.id && Array.isArray(s.notes); })
				.map(function(s) { s.custom = true; return s; });
		}
	} catch (e) {}
	return [];
}

function saveCustomSongs(instrument, songs) {
	try {
		var all = JSON.parse(progressGet(MY_SONGS_STORAGE_KEY) || "{}");
		all[instrument] = songs;
		progressSet(MY_SONGS_STORAGE_KEY, JSON.stringify(all));
	} catch (e) {}
}

// Best scores (notes played without help) per song for an instrument
function loadSongBest(instrument) {
	try {
		var best = JSON.parse(progressGet(SONGS_STORAGE_KEY) || "{}")[instrument];
		if (best && typeof best === "object") return best;
	} catch (e) {}
	return {};
}

function saveSongBest(instrument, best) {
	try {
		var all = JSON.parse(progressGet(SONGS_STORAGE_KEY) || "{}");
		all[instrument] = best;
		progressSet(SONGS_STORAGE_KEY, JSON.stringify(all));
	} catch (e) {}
}

// Play along's bests per song for an instrument, by speed:
// { songBestKey: { turtle: notes right, walk: ..., ... } }
function loadSongSpeedBest(instrument) {
	try {
		var best = JSON.parse(progressGet(SONG_SPEED_STORAGE_KEY) || "{}")[instrument];
		if (best && typeof best === "object") return best;
	} catch (e) {}
	return {};
}

function saveSongSpeedBest(instrument, best) {
	try {
		var all = JSON.parse(progressGet(SONG_SPEED_STORAGE_KEY) || "{}");
		all[instrument] = best;
		progressSet(SONG_SPEED_STORAGE_KEY, JSON.stringify(all));
	} catch (e) {}
}

// Trophy stars earned on a song so far (0 if never finished)
// (set: for 3-note songs, which 3 notes; see songBestKey())
function songStars(song, set) {
	var best = practice.songBest[songBestKey(song, set)];
	return typeof best === "number" ? challengeStars(best, songNotes(song).length) : 0;
}

// The button back to the song list from a song's result
function songListLabel() {
	return practice.songList === "three" ? "3-note songs" : practice.songList === "five" ? "5-note songs" : "All songs";
}

// The song list: one button per song with its stars, then the student's
// own songs (each with an edit button) and Make a song. list "three" (Play
// 3-note songs) shows just the 3-note songs and the student's
// songs with their first 3 notes; "five" (Play 5-note songs) the beginner
// songs and the student's songs with their first 5 notes; "all" (More songs) the other levels and the student's
// songs. Without one, the list shown last.
function showSongList(list) {
	if (list) practice.songList = list;
	var three = practice.songList === "three";
	var five = practice.songList === "five";
	stopSongPlayback();
	clearTimeout(practiceAdvanceTimer);
	stopNote();
	setPracticeMode("songs");
	practice.step = -1;
	document.getElementById("practice-view").setAttribute("data-step", "song-list");
	document.getElementById("practice-steps").innerHTML = "";
	document.getElementById("practice-prompt").textContent = three ? "Songs with " + threeNotesText()
		: five ? "Songs with your first 5 notes" : "Pick a song!";
	var body = document.getElementById("practice-body");
	body.innerHTML = "";
	var list = document.createElement("div");
	list.className = "song-list";
	function songButton(song) {
		var stars = songStars(song);
		var fastest = ALONG_SPEEDS[alongSpeedPassed(song)];
		var b = document.createElement("button");
		b.className = "song-choice";
		b.innerHTML = '<span class="song-choice-title"></span><span class="song-choice-stars" aria-hidden="true"></span>';
		b.firstChild.textContent = songTitle(song);
		// The fastest speed played along at, like a medal
		b.lastChild.textContent = (fastest ? fastest.icon + " " : "") + starText(stars);
		b.setAttribute("aria-label", songTitle(song) + ", " + stars + " of 3 stars" +
			(fastest ? ", played along at " + fastest.name + " speed" : ""));
		b.onclick = function() { playThroughSong(song.id); };
		return b;
	}
	// Each level is a button that shows or hides its songs in place; what's
	// open stays open (and the level of the song just played opens)
	if (practice.song && practice.song.song.level) songLevelsOpen[practice.song.song.level] = true;
	if (three || five) {
		listSongs(practice.songList).forEach(function(song) { list.appendChild(songButton(song)); });
	}
	SONG_LEVELS.filter(function(level) { return !three && !five && level.id !== "beginner"; }).forEach(function(level) {
		var songs = SONGS.filter(function(song) { return song.level === level.id; });
		var earned = songs.reduce(function(t, song) { return t + songStars(song); }, 0);
		var toggle = document.createElement("button");
		toggle.className = "song-choice song-level";
		toggle.setAttribute("data-level", level.id);
		toggle.innerHTML = '<span class="song-level-chevron" aria-hidden="true"></span>' +
			'<span class="song-level-text"><span class="song-choice-title"></span><span class="song-level-sub"></span></span>' +
			'<span class="song-choice-stars"></span>';
		toggle.querySelector(".song-choice-title").textContent = level.title;
		toggle.querySelector(".song-level-sub").textContent = level.sub;
		toggle.querySelector(".song-choice-stars").textContent = "\u2605 " + earned + "/" + songs.length * 3;
		toggle.querySelector(".song-choice-stars").setAttribute("aria-label", earned + " of " + songs.length * 3 + " stars");
		var panel = document.createElement("div");
		panel.className = "song-level-songs";
		panel.id = "song-level-" + level.id;
		songs.forEach(function(song) { panel.appendChild(songButton(song)); });
		toggle.setAttribute("aria-controls", panel.id);
		function show(open) {
			panel.hidden = !open;
			toggle.setAttribute("aria-expanded", open ? "true" : "false");
		}
		show(!!songLevelsOpen[level.id]);
		toggle.onclick = function() {
			songLevelsOpen[level.id] = !songLevelsOpen[level.id];
			show(songLevelsOpen[level.id]);
			if (songLevelsOpen[level.id]) panel.lastChild.scrollIntoView({ block: "nearest", behavior: "smooth" });
		};
		list.appendChild(toggle);
		list.appendChild(panel);
	});

	var heading = document.createElement("div");
	heading.className = "song-list-heading";
	heading.textContent = three ? "My 3-note songs" : five ? "My 5-note songs" : "My songs";
	list.appendChild(heading);
	listCustomSongs(practice.songList).forEach(function(song) {
		var item = document.createElement("div");
		item.className = "song-item";
		var play = songButton(song);
		// A song with nothing to play yet opens in the editor
		if (!songNotes(song).length) play.onclick = function() { openSongEditor(song.id); };
		item.appendChild(play);
		var edit = document.createElement("button");
		edit.className = "song-edit";
		edit.innerHTML = PENCIL_SVG;
		edit.setAttribute("aria-label", "Edit " + song.title);
		edit.title = "Edit";
		edit.onclick = function() { openSongEditor(song.id); };
		item.appendChild(edit);
		list.appendChild(item);
	});
	var make = document.createElement("button");
	make.className = "song-choice song-new";
	make.innerHTML = '<span class="song-new-plus" aria-hidden="true">+</span><span class="song-choice-title"></span>';
	make.lastChild.textContent = three ? "Make a 3-note song" : five ? "Make a 5-note song" : "Make a song";
	make.onclick = function() { openSongEditor(null, three ? practice.threeSet : five ? "first5" : null); };
	list.appendChild(make);

	body.appendChild(list);
	// Nothing here listens; the mic starts with the song
	if (practiceStartedMic && listenActive) stopListening();
	practiceStartedMic = false;
}

// from: start partway (Practice the red notes), notes before it counted done;
// to: stop before note to (Pick a part: just the measures picked)
function startSong(id, from, to) {
	stopSongPlayback();
	clearTimeout(practiceAdvanceTimer);
	stopNote();
	var song = findSong(id);
	setPracticeMode("song");
	practice.index = -1;
	var events = songEvents(song);
	practice.song = {
		id: id, song: song, events: events, notes: songNotes(song, events),
		measures: events.length ? events[events.length - 1].measure + 1 : 0,
		pos: 0, results: [], streak: 0
	};
	if (from) {
		practice.song.from = from;
		practice.song.pos = from;
		for (var i = 0; i < from; i++) practice.song.results.push(true);
	}
	if (to !== undefined) practice.song.to = to;
	document.getElementById("practice-view").setAttribute("data-step", "song");
	document.getElementById("practice-prompt").textContent = songTitle(song);

	var body = document.getElementById("practice-body");
	body.innerHTML =
		'<div class="practice-feedback" id="practice-feedback" aria-live="polite">Get ready…</div>' +
		'<div class="practice-feedback-sub" id="practice-feedback-sub">&nbsp;</div>';
	var actions = document.createElement("div");
	actions.className = "practice-actions";
	var hear = practiceButton(songHearLabel(), "secondary", function() {
		if (songPlayTimer !== null) stopSongPlayback(); else playSong();
	});
	hear.id = "song-hear";
	var help = practiceButton("Help", "secondary", showSongHelp);
	help.id = "song-help";
	actions.appendChild(hear);
	actions.appendChild(help);
	actions.appendChild(practiceButton("Pick a part", "secondary", function() {
		showSongPicker(id, function() { startSong(id); }, songPart(practice.song));
	}));
	actions.appendChild(practiceButton("Play it through", "secondary", function() { playThroughSong(id); }));
	body.appendChild(actions);

	if (!listenActive) {
		practiceStartedMic = true;
		startListening();
	}
	showSongNote();
}

// Play it through: the whole song on the page with no arrow and no waiting
// on each note, so a student who has played it perfectly can play it
// smoothly. The mic follows along (updateFollowListen): notes played right
// turn green as they go, and mistakes show only at the end.
function playThroughSong(id) {
	stopSongPlayback();
	clearTimeout(practiceAdvanceTimer);
	stopNote();
	var song = findSong(id);
	setPracticeMode("song");
	practice.index = -1;
	practice.target = null;
	practice.ghost = null;
	var events = songEvents(song);
	practice.song = {
		id: id, song: song, events: events, notes: songNotes(song, events),
		measures: events.length ? events[events.length - 1].measure + 1 : 0,
		pos: 0, results: [], streak: 0, free: true
	};
	document.getElementById("practice-view").setAttribute("data-step", "song-free");
	document.getElementById("practice-prompt").textContent = songTitle(song);
	document.getElementById("practice-steps").innerHTML = "";
	document.getElementById("practice-steps").appendChild(songSettingsButton(song, true));
	document.getElementById("practice-staff-output").scrollTop = 0;
	resetFollow();
	// The mic waits for Listen to me (or Play along)
	songMicOff();
	updateSpeedPicker();
}

// Start (or restart) a run through the song: nothing played yet
function resetFollow() {
	var s = practice.song;
	clearTimeout(practiceAdvanceTimer);
	practice.step = 3;
	practice.lastFrame = null;
	s.pos = 0;
	s.results = s.notes.map(function() { return null; });
	s.follow = { seg: null, silentMs: 0, heard: [], started: false, lastSound: 0, listening: false };
	s.along = null;
	s.check = null;
	s.played = s.notes.map(function() { return null; });
	s.done = false;
	removeSongFingerings();
	s.tapped = null;

	var body = document.getElementById("practice-body");
	body.innerHTML =
		'<div class="practice-feedback" id="practice-feedback" aria-live="polite">Play it all the way through!</div>' +
		'<div class="practice-feedback-sub" id="practice-feedback-sub">Tap a note to see how to play it</div>';
	var actions = document.createElement("div");
	actions.className = "practice-actions song-free-actions";
	var listen = practiceButton(LISTEN_TO_ME_LABEL, "primary", startFollow);
	listen.id = "song-listen";
	actions.appendChild(listen);
	var hear = practiceButton("\u25b6 Hear the song", "secondary", function() {
		if (songPlayTimer !== null) stopSongPlayback(); else playSong();
	});
	hear.id = "song-hear";
	actions.appendChild(hear);
	var along = practiceButton(playAlongLabel(), "secondary", function() {
		var playing = songPlayAlong;
		stopSongPlayback();
		if (!playing) playAlong();
	});
	along.id = "song-along";
	actions.appendChild(along);
	actions.appendChild(songMoreMenu([
		["Note by note", function() { startSong(s.id); }],
		["Pick a part", function() { showSongPicker(s.id, function() { playThroughSong(s.id); }); }],
		[TIMING_CHECK_LABEL, startTimingCheck]
	]));
	body.appendChild(actions);
	drawSongLine(0);
}

// A "⋯" button opening a small menu of the less used ways to practice
// a song (Play it through and its scores keep one row of buttons). Taps
// elsewhere and Escape close it.
function songMoreMenu(items) {
	var button = practiceButton("\u22ef", "secondary song-more-button", null);
	button.setAttribute("aria-label", "More ways to practice");
	var menu = document.createElement("div");
	menu.className = "song-more-menu";
	menu.setAttribute("role", "menu");
	var pop = songPopover("song-more", button, menu);
	items.forEach(function(item) {
		var b = practiceButton(item[0], "secondary", function() {
			pop.close();
			item[1]();
		});
		b.setAttribute("role", "menuitem");
		menu.appendChild(b);
	});
	return pop.wrap;
}

// A button and the panel it opens under (or over) it: taps elsewhere and
// Escape close it. Returns { wrap, close }.
function songPopover(className, button, panel) {
	var wrap = document.createElement("div");
	wrap.className = className;
	button.setAttribute("aria-haspopup", "true");
	button.setAttribute("aria-expanded", "false");
	button.onclick = function() {
		if (panel.hidden) open(); else close();
	};
	panel.hidden = true;
	function outside(event) {
		if (!wrap.contains(event.target)) close();
	}
	function open() {
		panel.hidden = false;
		// Kept on screen, clear of its edges
		panel.style.translate = "";
		var r = panel.getBoundingClientRect(), edge = 12;
		var shift = r.left < edge ? edge - r.left
			: r.right > window.innerWidth - edge ? window.innerWidth - edge - r.right : 0;
		if (shift) panel.style.translate = shift + "px 0";
		button.setAttribute("aria-expanded", "true");
		document.addEventListener("pointerdown", outside, true);
		var first = panel.querySelector("button:not(:disabled)");
		if (first) first.focus();
	}
	function close() {
		panel.hidden = true;
		button.setAttribute("aria-expanded", "false");
		document.removeEventListener("pointerdown", outside, true);
	}
	wrap.addEventListener("keydown", function(event) {
		if (event.key === "Escape" && !panel.hidden) {
			event.stopPropagation();
			close();
			button.focus();
		}
	});
	wrap.appendChild(button);
	wrap.appendChild(panel);
	return { wrap: wrap, close: close };
}

var LISTEN_TO_ME_LABEL = "\ud83c\udfa4 Listen to me";

// Listen to me: the mic on and a run started; the button turns into Stop
// and score
function startFollow() {
	var s = practice.song;
	stopSongPlayback();
	if (s.pos > 0 || s.done || s.along) resetFollow();
	s.follow.listening = true;
	practice.ignoreUntil = performance.now() + 300;
	songMicOn();
	setPracticeFeedback("I\u2019m listening!", "Play it all the way through", "good");
	var listen = document.getElementById("song-listen");
	if (listen) {
		listen.textContent = "\u25a0 Stop and score";
		listen.onclick = finishFollow;
	}
}

// The mic for a song, on only while something is listening (left alone if
// the student had it on before Practice did)
function songMicOn() {
	if (listenActive && !practiceStartedMic) return;
	practiceStartedMic = true;
	if (!listenActive && !listenStarting) startListening();
}

// Off again; a mic still starting up is stopped once it has, unless it's
// been wanted again meanwhile
function songMicOff() {
	if (!practiceStartedMic) return;
	practiceStartedMic = false;
	if (listenActive) {
		stopListening();
	} else if (listenStarting) {
		(function wait() {
			setTimeout(function() {
				if (listenStarting) wait();
				else if (listenActive && !practiceStartedMic) stopListening();
			}, 50);
		})();
	}
}

// Mic frames during Play it through. The sound is cut into notes: a new note
// starts when the pitch moves FOLLOW_SAME_NOTE from the note's pitch so far
// or the same pitch is tongued again (a dip in loudness, then a rise), and
// counts once it has held FOLLOW_NOTE_MS. Each note played (its average
// pitch, written, in fractional semitones, so one out of tune can be told
// apart) goes to followNote(), alongNote() or timingCheckNote().
function updateFollowListen(now, freq, level) {
	var s = practice.song, f = s.follow, a = s.along, check = s.check;
	if (practice.step !== 3) return;
	var dt = practice.lastFrame === null ? 0 : Math.min(now - practice.lastFrame, 100);
	practice.lastFrame = now;
	if (check) {
		// The timing check's clicks are high: not the student's notes
		if (check.done) return;
		if (freq && 69 + 12 * Math.log(freq / 440) / Math.LN2 >= TIMING_CHECK_IGNORE_MIDI) freq = null;
	} else if (a) {
		// Play along: the mic listens over the piano (see alongNote())
		if (a.done) return;
		if (!a.times.length) {
			// The count-in: how loud the speakers are at the mic, and how
			// long their clicks take to reach it
			a.bleed = Math.max(a.bleed, level);
			alongClickRise(a, now, level);
			f.seg = null;
			return;
		}
		// Not louder than the piano: that's the piano the mic is hearing. As
		// quiet as that, a note held is being tongued again.
		if (level < Math.min(ALONG_GATE_MAX, a.bleed * ALONG_BLEED_FACTOR)) {
			freq = null;
			if (f.seg) {
				f.seg.low = f.seg.dipped ? Math.min(f.seg.low, level) : level;
				f.seg.dipped = true;
			}
		}
	} else if (!f.listening || now < (practice.ignoreUntil || 0)) {
		f.seg = null;
		return;
	}

	if (!freq) {
		f.silentMs += dt;
		if (f.silentMs >= FOLLOW_GAP_MS) f.seg = null;
		if (a || check) return;
		// Stopped: soon after reaching the last note, or after a long quiet
		var quiet = s.pos >= s.notes.length ? 1500 : FOLLOW_END_SILENCE_MS;
		if (f.started && now - f.lastSound > quiet) finishFollow();
		return;
	}
	f.silentMs = 0;
	f.lastSound = now;
	var written = 69 + 12 * Math.log(freq / 440) / Math.LN2 + getTransposition();

	var seg = f.seg;
	if (seg && Math.abs(written - seg.pitch) <= FOLLOW_SAME_NOTE) {
		if (!seg.dipped) {
			if (level < seg.peak * SONG_RETONGUE_DIP) {
				seg.dipped = true;
				seg.low = level;
			} else {
				seg.peak = Math.max(seg.peak, level);
			}
		} else {
			seg.low = Math.min(seg.low, level);
			// Loud again after the dip: tongued again, so a new note
			if (level * SONG_RETONGUE_DIP >= seg.low) seg = null;
		}
	} else {
		seg = null;
	}
	if (!seg) seg = f.seg = { pitch: written, sum: 0, frames: 0, ms: 0, peak: level, dipped: false, low: 0, counted: false };
	// Its pitch: the average so far (a note held a bit out of tune is one note)
	seg.sum += written;
	seg.frames++;
	seg.pitch = seg.sum / seg.frames;
	seg.ms += dt;
	if (!seg.counted && seg.ms >= FOLLOW_NOTE_MS) {
		seg.counted = true;
		f.started = true;
		if (check) timingCheckNote(now - seg.ms);
		else if (a) alongNote(seg.pitch, now - seg.ms);
		else followNote(seg.pitch);
	}
}

// What a note played (written, fractional semitones) was, against a song
// note: "right" (within PRACTICE_PASS_CENTS + 15, as the mic has always
// allowed), "octave" (that, an octave off), "low" / "high" (out of tune,
// within HEARD_CLOSE_CENTS) or "wrong"
function heardAs(played, midi) {
	var cents = (played - midi) * 100, near = PRACTICE_PASS_CENTS + 15;
	if (Math.abs(cents) <= near) return "right";
	if (Math.abs(Math.abs(cents) - 1200) <= near) return "octave";
	if (Math.abs(cents) <= HEARD_CLOSE_CENTS) return cents < 0 ? "low" : "high";
	return "wrong";
}

// How far apart, for lining notes up: an octave or out of tune costs less
// than a wrong note
var HEARD_COST = { right: 0, octave: 0.2, low: 0.3, high: 0.3, wrong: 1 };

// A note was played: line up everything heard so far with the song
// (alignFollow) and color what it says was played right. The run ends once
// the last note is played right; otherwise after the student stops.
function followNote(pitch) {
	var s = practice.song, f = s.follow;
	f.heard.push(pitch);
	var a = alignFollow(f.heard, s.notes, false);
	s.results = a.results;
	s.played = a.played;
	s.pos = a.end;
	drawSongLine(a.end);
	if (a.end >= s.notes.length && a.results[a.end - 1] !== "wrong" && a.results[a.end - 1] !== "missed") {
		practice.step = 4;
		practiceAdvanceTimer = setTimeout(finishFollow, 700);
	}
}

// Line up the notes heard with the song's notes (edit distance): each heard
// note matches a song note (right, an octave off, or low or high: heardAs()),
// replaces one (wrong) or is extra; song notes nothing lines up with were
// missed. The whole run is weighed at once, so a wrong note and a skipped
// one aren't mixed up. Unless toEnd, the song may stop partway (the student
// isn't done): results past end stay null. played: song note → the pitch
// heard for it.
function alignFollow(heard, notes, toEnd) {
	var m = heard.length, n = notes.length, i, j;
	function cost(h, e) {
		return HEARD_COST[heardAs(h, e)];
	}
	var D = [];
	for (i = 0; i <= m; i++) {
		D.push([]);
		for (j = 0; j <= n; j++) {
			if (i === 0) D[i][j] = j;
			else if (j === 0) D[i][j] = i;
			else D[i][j] = Math.min(D[i - 1][j - 1] + cost(heard[i - 1], notes[j - 1].midi),
				D[i - 1][j] + 1, D[i][j - 1] + 1);
		}
	}
	// Where the student has got to: the cheapest place, the furthest on a tie
	var end = n;
	if (!toEnd) {
		end = 0;
		for (j = 1; j <= n; j++) if (D[m][j] < D[m][end] + 1e-6) end = j;
	}
	var results = notes.map(function() { return null; });
	var played = notes.map(function() { return null; });
	i = m;
	j = end;
	// Walk back from the end. Where skipping a note costs the same as
	// matching it, skip it: in a run of the same note, the last one is the
	// one missed.
	function same(x, y) { return Math.abs(x - y) < 1e-6; }
	while (j > 0) {
		var c = i > 0 ? cost(heard[i - 1], notes[j - 1].midi) : 0;
		if (same(D[i][j], D[i][j - 1] + 1)) {
			results[j - 1] = "missed";
			j--;
		} else if (i > 0 && same(D[i][j], D[i - 1][j - 1] + c)) {
			results[j - 1] = heardAs(heard[i - 1], notes[j - 1].midi);
			played[j - 1] = heard[i - 1];
			i--;
			j--;
		} else {
			i--;  // an extra note
		}
	}
	return { results: results, end: end, played: played };
}

// The end of a run (the last note, or the student stopped): the whole song
// in green and red, a score, and the way to fix the misses
function finishFollow() {
	var s = practice.song;
	if (s.along) {
		finishAlong(true);
		return;
	}
	if (s.done) return;
	s.done = true;
	practice.step = 4;
	clearTimeout(practiceAdvanceTimer);
	// Stopped partway (Stop and score, or a long quiet): notes never reached
	// stay black. At the end, line up with the whole song, so a wrong or
	// missing last note shows.
	var total = s.notes.length;
	var a = alignFollow(s.follow.heard, s.notes, false);
	var partway = a.end < total - 1;
	if (!partway) a = alignFollow(s.follow.heard, s.notes, true);
	s.results = a.results;
	s.played = a.played;
	s.pos = total;
	s.follow.listening = false;
	drawSongLine(s.pos);
	songMicOff();
	var right = s.results.filter(function(r) { return r === "right" || r === "octave"; }).length;
	var octaves = s.results.filter(function(r) { return r === "octave"; }).length;
	var firstMiss = s.results.findIndex(function(r) { return r === "wrong" || r === "missed"; });
	var offText = songOffText(s);
	var stars = challengeStars(right, total);
	var prev = practice.songBest[songBestKey(s.song)];
	var newBest = s.follow.heard.length > 0 && (typeof prev !== "number" || right > prev);
	if (newBest) {
		practice.songBest[songBestKey(s.song)] = right;
		saveSongBest(practice.instrument, practice.songBest);
	}
	if (!s.follow.heard.length) {
		setPracticeFeedback("No notes heard", "Play into the mic, then try again", "close");
	} else {
		setPracticeFeedback(
			right === total ? "Perfect! " + starText(stars) : right + " of " + total + " notes right " + starText(stars),
			octaves ? octaves + (octaves === 1 ? " note was" : " notes were") + " an octave off"
				: partway ? "You stopped partway through"
				: offText ? "Orange notes: " + offText
				: s.results.indexOf("wrong") >= 0 ? "Tap a red note to see what you played"
				: firstMiss >= 0 ? "The red notes need practice" : "\u00a0",
			right === total ? "good" : "close");
	}

	var actions = document.querySelector("#practice-body .practice-actions");
	actions.innerHTML = "";
	if (firstMiss >= 0) {
		actions.appendChild(practiceButton("Practice the red notes", "secondary", function() {
			startSong(s.id, songLineStart(firstMiss));
		}));
	}
	actions.appendChild(practiceButton("Play again", right === total ? "secondary" : "primary", resetFollow));
	// Played it all right: the next song waits beside Play again
	var songs = s.song.custom
		? listCustomSongs(practice.songList)
		: listSongs(practice.songList || "all");
	songs = songs.filter(function(song) { return songNotes(song).length; });
	var next = songs[songs.indexOf(s.song) + 1];
	if (right === total && next) {
		actions.appendChild(practiceButton("Next song \u2192", "primary", function() { playThroughSong(next.id); }));
	}
	actions.appendChild(songMoreMenu([
		["Pick a part", function() {
			var m = firstMiss >= 0 ? s.notes[firstMiss].measure : null;
			showSongPicker(s.id, function() { playThroughSong(s.id); }, m === null ? null : { a: m, b: m });
		}],
		["Note by note", function() { startSong(s.id); }]
	]));
	if (stars > 0) addPathNextButton(actions);
	if (right === total) launchFireworks(document.getElementById("practice-stage"));
	if (s.follow.heard.length) {
		recordProgress(10 + 2 * right + (right === total ? 15 : 0) + (newBest && right > 0 ? NEW_BEST_XP : 0));
	}
}

// The first note on the line holding note pos, so practice starts from the
// beginning of the tricky line
function songLineStart(pos) {
	var line = songLineOf(pos);
	for (var i = 0; i < pos; i++) if (songLineOf(i) === line) return i;
	return pos;
}

// Pick a part: a student stuck on one spot picks the measures to work on
// and plays just those note by note. The whole song shows; a tap picks a
// measure, a second tap the last measure of the part (and the ones between),
// a tap after that starts over. back: where Cancel goes; pick: { a, b }
// measures to start with.
function showSongPicker(id, back, pick) {
	stopSongPlayback();
	clearTimeout(practiceAdvanceTimer);
	stopNote();
	var song = findSong(id);
	setPracticeMode("song");
	practice.index = -1;
	practice.step = -1;
	practice.target = null;
	practice.ghost = null;
	var events = songEvents(song);
	practice.song = {
		id: id, song: song, events: events, notes: songNotes(song, events),
		measures: events.length ? events[events.length - 1].measure + 1 : 0,
		pos: 0, results: [], streak: 0,
		pick: { a: pick ? pick.a : null, b: pick ? pick.b : null }, back: back
	};
	document.getElementById("practice-view").setAttribute("data-step", "song-pick");
	document.getElementById("practice-prompt").textContent = songTitle(song);
	document.getElementById("practice-steps").innerHTML = "";
	document.getElementById("practice-steps").appendChild(songSettingsButton(song, false));
	document.getElementById("practice-staff-output").scrollTop = 0;

	var body = document.getElementById("practice-body");
	body.innerHTML =
		'<div class="practice-feedback" id="practice-feedback" aria-live="polite"></div>' +
		'<div class="practice-feedback-sub" id="practice-feedback-sub">&nbsp;</div>';
	var actions = document.createElement("div");
	actions.className = "practice-actions";
	var hear = practiceButton(songHearLabel(), "secondary", function() {
		if (songPlayTimer !== null) stopSongPlayback(); else playSong();
	});
	hear.id = "song-hear";
	actions.appendChild(hear);
	actions.appendChild(practiceButton("Cancel", "secondary", back));
	var go = practiceButton("Practice it", "primary", function() {
		var range = songPartNotes(practice.song);
		if (range) startSong(id, range.from, range.to);
	});
	go.id = "song-pick-go";
	actions.appendChild(go);
	body.appendChild(actions);
	// Nothing listens while picking
	if (practiceStartedMic && listenActive) stopListening();
	practiceStartedMic = false;
	updateSongPicker();
}

// The prompt, buttons and staff for the measures picked so far
function updateSongPicker() {
	var s = practice.song;
	var part = songPart(s);
	var range = songPartNotes(s);
	if (!part) {
		setPracticeFeedback("Tap a measure to practice", "Tap another to practice a few in a row");
	} else if (!range) {
		setPracticeFeedback("There are only rests there", "Tap a measure with notes in it", "close");
	} else {
		var count = range.to - range.from;
		setPracticeFeedback(partLabel(part, true),
			count + (count === 1 ? " note" : " notes") + (part.a === part.b ? " \u00b7 tap another measure to add more" : ""),
			"good");
	}
	var go = document.getElementById("song-pick-go");
	if (go) go.disabled = !range;
	var hear = document.getElementById("song-hear");
	if (hear && songPlayTimer === null) hear.textContent = songHearLabel();
	drawSongPicker(-1);
}

// Draw the whole song for picking: the measures picked shaded, their notes
// in the accent color; playing: the event being heard, in green
function drawSongPicker(playing) {
	var s = practice.song;
	var styles = getComputedStyle(document.body);
	var accent = styles.getPropertyValue("--accent").trim() || "#4f46e5";
	var done = styles.getPropertyValue("--success").trim() || "#16a34a";
	var part = songPart(s);
	var out = document.getElementById("practice-staff-output");
	var line = playing >= 0 ? Math.floor(s.events[playing].measure / SONG_MEASURES_PER_LINE)
		: part ? Math.floor(part.a / SONG_MEASURES_PER_LINE) : -1;
	var layouts = renderSongView(out, s.song, s.events, line, s.measures, { end: true, whole: true, ahead: playing >= 0 }, function(i) {
		if (i === playing) return done;
		var m = s.events[i].measure;
		return part && m >= part.a && m <= part.b ? accent : null;
	});
	s.pickLayouts = layouts;
	if (!part) return;
	var ns = "http://www.w3.org/2000/svg";
	Object.keys(layouts).forEach(function(l) {
		var r = layouts[l];
		if (!r.svg || !r.stave) return;
		Object.keys(r.measureX).forEach(function(k) {
			var m = parseInt(k, 10);
			if (m < part.a || m > part.b) return;
			var top = r.stave.getYForLine(0) - LINE_SPACING * 2;
			var rect = document.createElementNS(ns, "rect");
			rect.setAttribute("class", "song-pick-shade");
			rect.setAttribute("x", r.measureX[m][0] - 8);
			rect.setAttribute("y", top);
			rect.setAttribute("width", r.measureX[m][1] - r.measureX[m][0] + 12);
			rect.setAttribute("height", r.stave.getYForLine(4) - top + LINE_SPACING * 2);
			rect.setAttribute("rx", 6);
			rect.setAttribute("fill", accent);
			rect.setAttribute("fill-opacity", "0.13");
			r.svg.insertBefore(rect, r.svg.firstChild);
		});
	});
}

// A tap on the staff while picking: the measure under it
function songPickerTap(event) {
	if (!practiceOpen || !practice || practice.mode !== "song" || !practice.song || !practice.song.pick) return;
	var s = practice.song;
	if (songPlayTimer !== null) stopSongPlayback();
	var lineEl = event.target.closest ? event.target.closest(".song-line") : null;
	var r = lineEl && s.pickLayouts ? s.pickLayouts[lineEl.getAttribute("data-line")] : null;
	if (!r || !r.svg) return;
	var pt = r.svg.createSVGPoint();
	pt.x = event.clientX;
	pt.y = event.clientY;
	var x = pt.matrixTransform(r.svg.getScreenCTM().inverse()).x;
	// The measure tapped, or the nearest one
	var measure = null, best = Infinity;
	Object.keys(r.measureX).forEach(function(k) {
		var span = r.measureX[k];
		var d = x < span[0] ? span[0] - x : x > span[1] ? x - span[1] : 0;
		if (d < best) {
			best = d;
			measure = parseInt(k, 10);
		}
	});
	if (measure === null) return;
	var pick = s.pick;
	if (pick.a === null || pick.a !== pick.b) {
		pick.a = pick.b = measure;
	} else if (measure === pick.a) {
		pick.a = pick.b = null;
	} else {
		pick.b = Math.max(pick.a, measure);
		pick.a = Math.min(pick.a, measure);
	}
	updateSongPicker();
}

// The measures of the part being practiced or picked ({ a, b }), or null
// for the whole song
function songPart(s) {
	if (s.pick) return s.pick.a === null ? null : { a: s.pick.a, b: s.pick.b };
	if (s.to === undefined) return null;
	return { a: s.notes[s.from || 0].measure, b: s.notes[s.to - 1].measure };
}

// The notes of the measures picked: { from, to } (to past the last), or null
// if there are none
function songPartNotes(s) {
	var part = songPart(s);
	if (!part) return null;
	var from = -1, to = -1;
	s.notes.forEach(function(n, i) {
		if (n.measure < part.a || n.measure > part.b) return;
		if (from < 0) from = i;
		to = i + 1;
	});
	return from < 0 ? null : { from: from, to: to };
}

// The events (notes and rests) of a part's measures: { start, end }
function songPartEvents(s, part) {
	var start = s.events.length, end = s.events.length;
	for (var i = 0; i < s.events.length; i++) {
		if (s.events[i].measure >= part.a && start === s.events.length) start = i;
		if (s.events[i].measure > part.b) {
			end = i;
			break;
		}
	}
	return { start: start, end: end };
}

// Where note by note stops: the end of the part, or of the song
function songEnd(s) {
	return s.to !== undefined ? s.to : s.notes.length;
}

// "measure 3" or "measures 3–5" (capitalized to start a sentence)
function partLabel(part, capital) {
	var label = part.a === part.b ? "measure " + (part.a + 1)
		: "measures " + (part.a + 1) + "\u2013" + (part.b + 1);
	return capital ? label.charAt(0).toUpperCase() + label.slice(1) : label;
}

function songHearLabel() {
	return songPart(practice.song) ? "\u25b6 Hear this part" : "\u25b6 Hear the song";
}

// Point the round at the current note: highlight it, reset the hold, and put
// away any help from the last note
function showSongNote() {
	var s = practice.song;
	// The first note of a part has nothing played before it
	var prev = s.pos > (s.from || 0) ? s.notes[s.pos - 1].midi : null;
	practice.target = s.notes[s.pos].midi;
	practice.prevTarget = prev;
	practice.noteShownAt = performance.now();
	practice.step = 3;
	s.helped = false;
	resetPracticeHold();
	// Played straight on from the same note, a repeat would pass by itself
	practice.needRetongue = prev === practice.target;
	practice.retonguePeak = practice.songLevel || 0;

	var view = document.getElementById("practice-view");
	view.setAttribute("data-step", "song");
	var box = document.querySelector("#practice-body > .practice-fingering");
	if (box) box.remove();
	removeSongFingerings();
	s.tapped = null;
	var help = document.getElementById("song-help");
	if (help) {
		help.textContent = "Help";
		help.onclick = showSongHelp;
	}
	document.getElementById("practice-prompt").textContent = songTitle(s.song);
	drawSongLine(s.pos);
	renderSongProgress();
	if (s.pos === (s.from || 0)) {
		var part = songPart(s);
		setPracticeFeedback("Play the glowing note", part ? partLabel(part, true) : " ");
	} else if (practice.needRetongue) {
		setPracticeFeedback("Again!", "Tongue it: “too”", "good");
	}
}

// Reveal the current note's name, fingering and sound. It no longer scores.
function showSongHelp() {
	var s = practice.song;
	s.helped = true;
	s.streak = 0;
	renderSongProgress();
	document.getElementById("practice-view").setAttribute("data-step", "challenge-help");
	document.getElementById("practice-prompt").textContent = "This is " + songNoteName(s.notes[s.pos]) + ". Play it!";
	var help = document.getElementById("song-help");
	help.parentNode.parentNode.insertBefore(practiceFingeringBox(), help.parentNode);
	help.textContent = "▶ Hear it";
	help.onclick = function() {
		stopSongPlayback();
		playPracticeExample();
	};
	stopSongPlayback();
	playPracticeExample();
}

// Mic frames during a song (see updatePracticeListen)
function updateSongListen(now, freq, level) {
	if (practice.song.free) {
		updateFollowListen(now, freq, level);
		return;
	}
	if (practice.step !== 3) return;
	var dt = practice.lastFrame === null ? 0 : Math.min(now - practice.lastFrame, 100);
	practice.lastFrame = now;
	if (tuningTipOpen()) return;
	if (freq) practice.songLevel = practice.songLevel ? practice.songLevel * 0.7 + level * 0.3 : level;

	if (now < (practice.ignoreUntil || 0)) {
		setPracticeFeedback("Listen…", " ");
		return;
	}

	// A repeated note counts once it's been tongued again: a break in the
	// sound or a dip in loudness
	if (practice.needRetongue) {
		if (!freq || level < practice.retonguePeak * SONG_RETONGUE_DIP) {
			practice.needRetongue = false;
		} else {
			practice.retonguePeak = Math.max(practice.retonguePeak, level);
		}
	}

	var inZone = false;
	if (freq) {
		practice.lastSound = now;
		var written = 69 + 12 * Math.log(freq / 440) / Math.LN2 + getTransposition();
		var diff = written - practice.target;
		var cents = diff * 100;
		if (!practice.needRetongue) trackTuning(cents, dt);
		if (Math.abs(cents) <= PRACTICE_PASS_CENTS && practice.needRetongue) {
			setPracticeFeedback("Again!", "Tongue it: “too”", "good");
		} else if (Math.abs(cents) <= PRACTICE_PASS_CENTS) {
			inZone = true;
			practice.holdMs += dt;
			practice.lastGood = now;
			practice.hintDiff = null;
			practice.hintFrames = 0;
			setPracticeGhost(null);
			setPracticeFeedback("That’s it!", " ", "good");
		} else if (practice.prevTarget !== null && Math.abs(written - practice.prevTarget) < 0.5) {
			// Still sounding the note just passed: not a mistake, just not
			// moved on yet (a nudge if it lingers)
			practice.hintDiff = null;
			practice.hintFrames = 0;
			setPracticeGhost(null);
			if (now - practice.noteShownAt > 1200) setPracticeFeedback("Next note!", "Play the glowing note", "close");
		} else {
			practiceWrongNoteHint(diff, true);
		}
	} else {
		pushPitchTrace(now, null);
		if (now - practice.lastSound > PRACTICE_GHOST_CLEAR_MS) setPracticeGhost(null);
	}
	if (!freq && now - practice.lastSound > 1500) {
		setPracticeFeedback("Play the glowing note", " ");
	}

	if (!inZone && now - practice.lastGood > PRACTICE_GAP_MS && practice.holdMs > 0) {
		practice.holdMs = 0;
	}

	if (practice.holdMs >= SONG_HOLD_MS) passSongNote();
}

function passSongNote() {
	var s = practice.song;
	s.results.push(!s.helped);
	s.streak = s.helped ? 0 : s.streak + 1;
	s.pos++;
	if (s.pos < songEnd(s)) {
		showSongNote();
		if (!practice.needRetongue) setPracticeFeedback("That’s it!", " ", "good");
		return;
	}
	practice.step = 4;
	drawSongLine(s.pos);
	renderSongProgress();
	practiceAdvanceTimer = setTimeout(finishSong, 700);
}

function finishSong() {
	var s = practice.song;
	var total = s.notes.length;
	// Practiced a part: again until it's all on their own, then the whole song
	var picked = songPart(s);
	if (picked) {
		var notes = s.results.slice(s.from || 0, s.to);
		var mine = notes.filter(Boolean).length;
		showRoundResult(mine, false, "You practiced " + partLabel(picked) + "!",
			"You played " + mine + " of " + notes.length + " notes on your own",
			function() { startSong(s.id, s.from, s.to); }, notes.length,
			{ label: "Pick another part", onclick: function() {
				showSongPicker(s.id, function() { playThroughSong(s.id); }, picked);
			} });
		var buttons = document.querySelector("#practice-body .practice-actions");
		if (mine === notes.length) buttons.lastChild.className = "practice-btn secondary";
		buttons.appendChild(practiceButton("Play it through \u2192", mine === notes.length ? "primary" : "secondary",
			function() { playThroughSong(s.id); }));
		recordProgress(mine);
		return;
	}
	// Practiced from the red notes on: no best score, straight back to
	// playing it through
	if (s.from) {
		var part = s.results.slice(s.from);
		var own = part.filter(Boolean).length;
		showRoundResult(own, false, "You practiced the red notes!",
			"You played " + own + " of " + part.length + " notes on your own",
			function() { startSong(s.id, s.from); }, part.length,
			{ label: songListLabel(), onclick: function() { showSongList(); } });
		var acts = document.querySelector("#practice-body .practice-actions");
		acts.lastChild.className = "practice-btn secondary";
		acts.appendChild(practiceButton("Play it through \u2192", "primary", function() { playThroughSong(s.id); }));
		recordProgress(own);
		return;
	}
	var score = s.results.filter(Boolean).length;
	var prev = practice.songBest[songBestKey(s.song)];
	var newBest = typeof prev !== "number" || score > prev;
	if (newBest) {
		practice.songBest[songBestKey(s.song)] = score;
		saveSongBest(practice.instrument, practice.songBest);
	}
	showRoundResult(score, newBest,
		"You played " + songTitle(s.song) + "!",
		"You played " + score + " of " + total + " notes on your own",
		function() { startSong(s.id); }, total,
		{ label: songListLabel(), onclick: function() { showSongList(); } });
	// Note by note is practice: next, play it through again
	var actions = document.querySelector("#practice-body .practice-actions");
	actions.lastChild.className = "practice-btn secondary";
	actions.appendChild(practiceButton("Play it through \u2192", "primary", function() { playThroughSong(s.id); }));
	if (challengeStars(score, total) > 0) addPathNextButton(actions);
	recordProgress(10 + 2 * score + (newBest && score > 0 ? NEW_BEST_XP : 0));
}

// One dot per line of the song: green = played on your own, yellow = with
// some help, ringed = the line being played
function renderSongProgress() {
	var s = practice.song;
	var list = document.getElementById("practice-steps");
	list.innerHTML = "";
	if (s.free) return;
	var row = document.createElement("div");
	row.className = "challenge-progress";
	row.setAttribute("role", "img");
	// A part: one dot per measure picked
	var part = songPart(s);
	var unitOf = part ? function(i) { return s.notes[i].measure; } : songLineOf;
	var first = part ? part.a : 0;
	var last = part ? part.b : Math.ceil(s.measures / SONG_MEASURES_PER_LINE) - 1;
	var current = s.pos < songEnd(s) ? unitOf(s.pos) : last + 1;
	row.setAttribute("aria-label", (part ? "Measure " : "Line ") + (Math.min(current, last) - first + 1) + " of " + (last - first + 1));
	list.appendChild(songViewButton());
	list.appendChild(songSettingsButton(s.song, false));
	for (var u = first; u <= last; u++) {
		var dot = document.createElement("span");
		var helped = s.results.some(function(own, i) { return !own && unitOf(i) === u; });
		dot.className = "challenge-dot" +
			(u < current ? (helped ? " helped" : " own")
				: u === current ? " current" + (helped || s.helped ? " helping" : "") : "");
		row.appendChild(dot);
	}
	list.appendChild(row);
}

function songLineOf(pos) {
	return Math.floor(practice.song.notes[pos].measure / SONG_MEASURES_PER_LINE);
}

// Draw the line of the song holding note pos (the last line once the song is
// done): played notes green, note pos glowing in the accent color
function drawSongLine(pos) {
	var s = practice.song;
	if (s.pick) {
		drawSongPicker(-1);
		return;
	}
	if (s.free) {
		// Right notes green as they're played; mistakes show only at the end
		var styles = getComputedStyle(document.body);
		var good = styles.getPropertyValue("--success").trim() || "#16a34a";
		var bad = styles.getPropertyValue("--danger").trim() || "#e11d48";
		var off = styles.getPropertyValue("--warning").trim() || "#d97706";
		var byEvent = {};
		s.notes.forEach(function(n, i) { byEvent[n.event] = s.results[i]; });
		var marks = songOffMarks(s);
		var tapped = styles.getPropertyValue("--accent").trim() || "#4f46e5";
		var at = Math.min(pos, s.notes.length - 1);
		var ghost = songTappedGhost(s);
		s.layouts = renderSongView(document.getElementById("practice-staff-output"), s.song, s.events,
			s.done || pos === 0 ? -1 : songLineOf(at), s.measures,
			{ end: true, whole: true, ahead: true, marks: s.done ? marks : null, ghost: ghost, ghostAt: ghost === null ? null : s.tapped },
			function(i) {
				var r = byEvent[i];
				if (marks[i]) return off;
				return r === "right" || r === "octave" ? good : s.done && r ? bad : i === s.tapped ? tapped : null;
			});
		return;
	}
	var hl = pos < s.notes.length ? s.notes[pos].event : s.events.length;
	// An arrow over the note the mic is waiting for, and beside it the
	// wrong note being played, if any
	drawSongEvent(hl, pos < songEnd(s) ? hl : null, practice.ghost);
}

// Draw the line holding event hl (a note or rest; past the end = the last
// line, all played), events before it green; arrow: an event to point at
function drawSongEvent(hl, arrow, ghost) {
	var s = practice.song;
	var styles = getComputedStyle(document.body);
	var accent = styles.getPropertyValue("--accent").trim() || "#4f46e5";
	var done = styles.getPropertyValue("--success").trim() || "#16a34a";
	var e = s.events[Math.min(hl, s.events.length - 1)];
	// A part: the rest of the song grayed out
	var part = songPart(s);
	var muted = "rgba(100, 116, 139, 0.4)";
	var inPart = part ? songPartEvents(s, part) : null;
	if (part && hl >= inPart.end) e = s.events[inPart.end - 1];
	// Play along: the notes played right green, not just the ones gone by
	var byEvent = {};
	if (s.along) s.notes.forEach(function(n, j) { byEvent[n.event] = s.results[j]; });
	var marks = s.along ? songOffMarks(s) : {};
	var tapped = styles.getPropertyValue("--warning").trim() || "#d97706";
	s.layouts = renderSongView(document.getElementById("practice-staff-output"), s.song, s.events,
		Math.floor(e.measure / SONG_MEASURES_PER_LINE), s.measures,
		{ end: true, arrow: arrow === undefined ? null : arrow, ghost: ghost || null, whole: !!s.free, ahead: true },
		function(i) {
			if (inPart && (i < inPart.start || i >= inPart.end)) return muted;
			if (i === hl) return accent;
			if (i === s.tapped) return tapped;
			if (marks[i]) return tapped;  // out of tune, early or late: the same orange
			if (s.along) return byEvent[i] === "right" || byEvent[i] === "octave" ? done : null;
			return i < hl ? done : null;
		});
}

// Show songs with their key signatures (songKey()), or with no key
// signature and every sharp and flat written out (the default: how the
// built-in songs always read); remembered per browser
var SONG_KEY_SIG_STORAGE_KEY = "pitchdetect-song-key-signature";
var songKeySignatures = false;
try { songKeySignatures = localStorage.getItem(SONG_KEY_SIG_STORAGE_KEY) === "1"; } catch (e) {}

// What plays with Hear the song and Play along: the piano part (on by
// default) and a metronome click on each beat (off by default); remembered
// per browser
var SONG_PIANO_STORAGE_KEY = "pitchdetect-song-piano";
var SONG_CLICK_STORAGE_KEY = "pitchdetect-song-click";
var songPiano = true, songClick = false;
try {
	songPiano = localStorage.getItem(SONG_PIANO_STORAGE_KEY) !== "0";
	songClick = localStorage.getItem(SONG_CLICK_STORAGE_KEY) === "1";
} catch (e) {}

// A song's written key (VexFlow key name): a custom song's own; a built-in
// song's from its tonic as the song spells it (degree 1, the song's tonic,
// or the concert B♭ of a song with steps). "C" if that isn't a key with a
// signature to draw.
function songKey(song) {
	if (song.custom) return song.key || "C";
	var n = songTonic(song);
	if (!n || Math.abs(n.alter) > 1) return "C";
	var key = "CDEFGAB".charAt(n.letter) + (n.alter > 0 ? "#" : n.alter < 0 ? "b" : "");
	return key in keySignatureNotes ? key : "C";
}

// A song's tonic as written, { letter (0–6 = C–B), alter }, or null: a
// custom song's key; a built-in song's degree 1, its tonic, or the concert
// B♭ of a song with steps
function songTonic(song) {
	if (!song.measures) {
		var key = song.key || "C";
		return { letter: "CDEFGAB".indexOf(key.charAt(0)),
			alter: key.charAt(1) === "#" ? 1 : key.charAt(1) === "b" ? -1 : 0 };
	}
	var spelled = spellScale(song.level === "three" ? threeNoteScale()
		: song.scale ? practice.lessons[song.scale].notes : practiceNotes(song.steps || SCALE_STEPS));
	return spelled[song.tonic ? song.tonic - 1 : song.steps ? Math.max(0, song.steps.indexOf(0)) : 0] || null;
}

var SETTINGS_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
	'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';

// The song's settings, behind a gear (above Play it through and Pick a
// part, beside the whole song button in note by note): Play along's speed
// (speed: Play it through), the piano and the metronome, and key signature
// or accidentals, the last only for a song whose key has sharps or flats,
// where it changes something
function songSettingsButton(song, speed) {
	var key = songKey(song) !== "C";
	var button = document.createElement("button");
	button.className = "editor-tool song-settings-toggle";
	button.innerHTML = SETTINGS_SVG;
	button.setAttribute("aria-label", "Song settings");
	button.title = "Song settings";
	var panel = document.createElement("div");
	panel.className = "song-settings-panel";
	panel.setAttribute("role", "dialog");
	panel.setAttribute("aria-label", "Song settings");
	if (speed) {
		panel.appendChild(songSettingsTitle("Play along speed"));
		panel.appendChild(alongSpeedPicker());
	}
	panel.appendChild(songSettingsTitle("Piano"));
	panel.appendChild(songSettingsChoices("song-piano-picker", "Piano",
		[[true, "On"], [false, "Off"]], function() { return songPiano; }, setSongPiano));
	panel.appendChild(songSettingsTitle("Metronome"));
	panel.appendChild(songSettingsChoices("song-click-picker", "Metronome",
		[[true, "On"], [false, "Off"]], function() { return songClick; }, setSongClick));
	if (key) {
		panel.appendChild(songSettingsTitle("Sharps and flats"));
		panel.appendChild(songSettingsChoices("song-key-picker", "Sharps and flats",
			[[true, "In the key signature"], [false, "On each note"]],
			function() { return songKeySignatures; }, setSongKeySignatures));
	}
	return songPopover("song-settings", button, panel).wrap;
}

function songSettingsTitle(text) {
	var t = document.createElement("div");
	t.className = "song-settings-title";
	t.textContent = text;
	return t;
}

// A row of on/off choices in the song's settings: choices [[value, text]],
// value() the setting now, set(value) changes it. Every row shows the
// setting's current value (updateSongSettings()).
function songSettingsChoices(className, label, choices, value, set) {
	var row = document.createElement("div");
	row.className = "speed-picker song-setting-picker " + className;
	row.setAttribute("role", "group");
	row.setAttribute("aria-label", label);
	choices.forEach(function(choice) {
		var b = document.createElement("button");
		b.className = "speed-choice song-setting-choice";
		b.textContent = choice[1];
		b.onclick = function() { set(choice[0]); };
		row.appendChild(b);
	});
	row.update = function() {
		row.querySelectorAll(".song-setting-choice").forEach(function(b, i) {
			b.setAttribute("aria-pressed", choices[i][0] === value() ? "true" : "false");
		});
	};
	row.update();
	return row;
}

function updateSongSettings() {
	document.querySelectorAll(".song-setting-picker").forEach(function(row) {
		if (row.update) row.update();
	});
}

// The piano and metronome change what plays next time
function setSongPiano(on) {
	songPiano = on;
	try { localStorage.setItem(SONG_PIANO_STORAGE_KEY, on ? "1" : "0"); } catch (e) {}
	updateSongSettings();
}

function setSongClick(on) {
	songClick = on;
	try { localStorage.setItem(SONG_CLICK_STORAGE_KEY, on ? "1" : "0"); } catch (e) {}
	updateSongSettings();
}

function setSongKeySignatures(on) {
	songKeySignatures = on;
	try { localStorage.setItem(SONG_KEY_SIG_STORAGE_KEY, on ? "1" : "0"); } catch (e) {}
	updateSongSettings();
	if (practice.mode === "song") drawSongLine(practice.song.pos);
}

// Key signatures offered for the student's own songs, counted the way they
// read them off the page (VexFlow key names)
var SONG_KEYS = [
	{ key: "C", label: "No \u266d or \u266f" },
	{ key: "F", label: "1 \u266d" }, { key: "Bb", label: "2 \u266d" }, { key: "Eb", label: "3 \u266d" },
	{ key: "Ab", label: "4 \u266d" }, { key: "Db", label: "5 \u266d" },
	{ key: "G", label: "1 \u266f" }, { key: "D", label: "2 \u266f" }, { key: "A", label: "3 \u266f" },
	{ key: "E", label: "4 \u266f" }, { key: "B", label: "5 \u266f" }, { key: "F#", label: "6 \u266f" },
	{ key: "Gb", label: "6 \u266d" }
];
var SONG_TIMES = ["4/4", "3/4", "2/4"];

// The alteration a key signature gives a letter (0–6 = C–B): -1, 0 or 1
function keyAlter(key, letter) {
	var name = "CDEFGAB".charAt(letter);
	var notes = keySignatureNotes[key] || [];
	if (notes.indexOf(name + "b") >= 0) return -1;
	if (notes.indexOf(name + "#") >= 0) return 1;
	return 0;
}

// A measure's length in quarter notes
function measureBeats(time) {
	var parts = (time || "4/4").split("/");
	return parseInt(parts[0], 10) * 4 / parseInt(parts[1], 10);
}

// Draw one line (SONG_MEASURES_PER_LINE measures, or opts.perLine) of a
// song's events into out, scaled like every other line. measures: how many
// measures the song has; color(i): event i's color or null. opts.end puts the final barline
// on the last measure; opts.left draws the whole line, empty measures and
// all (the editor, where notes are added), instead of centering a short one.
// With key signatures on (songKeySignatures, or opts.keySig: the editor) a
// song shows its key (songKey()) and accidentals last the measure as
// printed; off, there's no key signature and every sharp and flat is
// written on its note. Custom songs follow their time signature. opts.arrow: an event index to mark with an arrow
// above it (the note the mic is listening for); opts.ghost: a written MIDI
// note to show faintly beside that one (the wrong note being played), or
// beside opts.ghostAt;
// opts.marks: event index → a word to write above it (Play along's "early" /
// "late"). Returns { svg, stave, xs (event index → x), measureX
// (measure → [start, end] of its note area) }, in SVG units.
function renderSongLine(out, song, events, line, measures, opts, color) {
	out.innerHTML = "";
	var VF = Vex.Flow;
	var clef = getCurrentClef();
	var keySig = opts.keySig || songKeySignatures;
	var key = keySig ? songKey(song) : "C";
	var time = song.custom ? song.time || "4/4" : song.time || null;
	var perLine = opts.perLine || SONG_MEASURES_PER_LINE;
	var first = line * perLine;
	// The editor always draws whole lines, so there's room to add notes
	var count = opts.left ? perLine : Math.max(1, Math.min(perLine, measures - first));

	var H = opts.height || STAFF_VIEWBOX_HEIGHT;
	var y = Math.round((H - 4 * LINE_SPACING) / 2);
	// The widest line start (clef, key and time) sets the scale for all lines
	function startWidth(withTime) {
		var probe = new VF.Stave(0, y, SONG_MEASURE_WIDTH);
		probe.addClef(clef);
		if (key !== "C") probe.addKeySignature(key);
		if (withTime && time) probe.addTimeSignature(time);
		return probe.getNoteStartX() - probe.getX();
	}
	var widest = startWidth(true);
	var W = widest + perLine * SONG_MEASURE_WIDTH + 10;
	var renderer = new VF.Renderer(out, VF.Renderer.Backends.SVG);
	renderer.resize(W, H);
	var context = renderer.getContext();

	var x = 5 + (opts.left ? 0 : (perLine - count) * SONG_MEASURE_WIDTH / 2);
	var result = { svg: null, stave: null, xs: {}, measureX: {} };
	var arrowAt = null;
	var marksAt = [];  // opts.marks: words over notes ("early", "late")
	var drawn = {};  // event index → its StaveNote, for the ties
	var restated = {};  // tied notes starting a line with their accidental
	// Lines without the time signature share out its room, so every line of
	// a whole line's width ends at the same place
	var slack = count === perLine ? (widest - startWidth(first === 0)) / count : 0;
	for (var m = first; m < first + count; m++) {
		var extra = m === first ? startWidth(m === 0) : 0;
		var stave = new VF.Stave(x, y, SONG_MEASURE_WIDTH + extra + slack);
		if (m === first) {
			stave.addClef(clef);
			if (key !== "C") stave.addKeySignature(key);
			if (m === 0 && time) stave.addTimeSignature(time);
		}
		if (opts.end && m === measures - 1) stave.setEndBarType(VF.Barline.type.END);
		stave.setContext(context).draw();
		if (!result.stave) result.stave = stave;
		x += stave.getWidth();
		result.measureX[m] = [stave.getNoteStartX(), stave.getNoteEndX()];

		var tickables = [], indexes = [];
		var triplets = [], run = [];  // triplets: groups of 3 notes
		var inEffect = {};  // accidentals carried through the measure
		events.forEach(function(e, i) {
			if (e.measure !== m) return;
			var duration = e.dur + (e.dots ? "d" : "");
			var note;
			if (e.midi === null) {
				note = new VF.StaveNote({ clef: clef, keys: [clef === "bass" ? "d/3" : "b/4"], duration: duration + "r" });
			} else {
				var name = "cdefgab".charAt(e.letter);
				note = new VF.StaveNote({ clef: clef, keys: [name + "/" + e.octave], duration: duration, auto_stem: true });
				var shown;
				var place = name + e.octave;
				var current = place in inEffect ? inEffect[place] : keyAlter(key, e.letter);
				// A note tied over the bar line keeps its accidental unwritten
				// (at the start of a line it's written again)
				var held = e.tied && drawn[i - 1];
				if (!held && (e.alter !== current || (!keySig && e.alter))) shown = e.alter;
				if (!held) inEffect[place] = e.alter;
				if (shown !== undefined) note.addAccidental(0, new VF.Accidental(shown < 0 ? "b" : shown > 0 ? "#" : "n"));
				if (shown !== undefined && e.tied) restated[i] = true;
			}
			if (e.dots) note.addDotToAll();
			// A tied-over note colored like the note it holds on from
			var c = color(i);
			if (!c && e.tied) c = color(tieStart(events, i));
			if (c) note.setStyle({ fillStyle: c, strokeStyle: c });
			drawn[i] = note;
			tickables.push(note);
			indexes.push(i);
			if (e.tuplet) {
				run.push(note);
				if (run.length === 3) {
					triplets.push(run);
					run = [];
				}
			} else {
				run = [];
			}
		});
		if (!tickables.length) continue;
		try {
			var beats = time ? time.split("/") : ["4", "4"];
			var voice = new VF.Voice({ num_beats: parseInt(beats[0], 10), beat_value: parseInt(beats[1], 10) }).setStrict(false);
			// Tuplets set their notes' ticks, so before the voice counts them;
			// a triplet is beamed on its own, with a bracket if it has a rest
			var tuplets = triplets.map(function(g) {
				var rests = g.some(function(t) { return t.isRest(); });
				return new VF.Tuplet(g, { num_notes: 3, notes_occupied: 2, bracketed: rests });
			});
			voice.addTickables(tickables);
			// Eighths are beamed by the beat (a dotted quarter's in 6/8)
			// they fall in, counted from the bar line, so after a dotted
			// quarter the offbeat eighth stands alone and the next beat's
			// pair is beamed (VexFlow's own beaming loses count there)
			var group = VF.Beam.getDefaultBeamGroups(beats.join("/"))[0];
			var groupBeats = 4 * group.numerator / group.denominator;
			var beams = [], beamRun = [], runGroup = -1, at = 0;
			var inTriplet = function(t) { return triplets.some(function(g) { return g.indexOf(t) >= 0; }); };
			var endRun = function() {
				if (beamRun.length > 1) beams.push(new VF.Beam(beamRun, true));
				beamRun = [];
			};
			tickables.forEach(function(t, k) {
				var e = events[indexes[k]];
				var len = eventBeats(e);
				var g = Math.floor(at / groupBeats + 1e-6);
				var beamable = !inTriplet(t) && e.midi !== null && SONG_BEATS[e.dur] < 1 && at + len <= (g + 1) * groupBeats + 1e-6;
				if (!beamable || g !== runGroup) endRun();
				if (beamable) {
					beamRun.push(t);
					runGroup = g;
				}
				at += len;
			});
			endRun();
			triplets.forEach(function(g) {
				if (!g.some(function(t) { return t.isRest(); })) beams.push(new VF.Beam(g, true));
			});
			// The 3 on the beam's side, leaving the heads' side for a slur
			tuplets.forEach(function(t, k) {
				t.setTupletLocation(triplets[k][0].getStemDirection() < 0 ? VF.Tuplet.LOCATION_BOTTOM : VF.Tuplet.LOCATION_TOP);
			});
			// A low softmax spaces notes by their length, so a measure reads
			// like printed music instead of bunching at its start
			new VF.Formatter({ softmaxFactor: 2 }).joinVoices([voice]).format([voice], stave.getNoteEndX() - stave.getNoteStartX() - 10);
			voice.draw(context, stave);
			beams.forEach(function(b) { b.setContext(context).draw(); });
			tuplets.forEach(function(t) { t.setContext(context).draw(); });
			tickables.forEach(function(t, k) {
				result.xs[indexes[k]] = t.getAbsoluteX() + t.getGlyphWidth() / 2;
				if (opts.marks && opts.marks[indexes[k]]) {
					var mbox = t.getBoundingBox();
					marksAt.push({ x: result.xs[indexes[k]], top: Math.min(mbox ? mbox.getY() : Infinity, stave.getYForLine(0)),
						text: opts.marks[indexes[k]], color: color(indexes[k]) });
				}
				if (indexes[k] === opts.arrow) {
					var box = t.getBoundingBox();
					arrowAt = { x: result.xs[indexes[k]], top: Math.min(box ? box.getY() : Infinity, stave.getYForLine(0)), color: color(indexes[k]) };
				}
				var ghostAt = opts.ghostAt === undefined || opts.ghostAt === null ? opts.arrow : opts.ghostAt;
				if (opts.ghost && indexes[k] === ghostAt) drawPracticeGhost(context, stave, clef, opts.ghost, t);
			});
		} catch (err) {
			console.log("Could not render song measure:", m, err.message);
		}
	}

	// Ties, from a line's end or to its start when they cross lines
	events.forEach(function(e, i) {
		if (!e.tie || !events[i + 1] || !events[i + 1].tied) return;
		var first = drawn[i] || null, last = drawn[i + 1] || null;
		// (no tie into a line's first note over its accidental)
		if (!first && (!last || restated[i + 1])) return;
		try {
			new VF.StaveTie({ first_note: first, last_note: last, first_indices: [0], last_indices: [0] })
				.setContext(context).draw();
		} catch (err) {
			console.log("Could not draw a tie:", i, err.message);
		}
	});

	// Slurs, from a line's end or to its start when they cross lines (one
	// over a whole line between its ends isn't drawn)
	var slurFrom = -1;
	events.forEach(function(e, i) {
		if (e.slurEnd && slurFrom >= 0) {
			var from = drawn[slurFrom] || null, to = drawn[i] || null;
			if (from || to) {
				// Under the heads when every stem is up, else over the top
				var above = false;
				for (var k = slurFrom; k <= i; k++) {
					if (drawn[k] && drawn[k].getStemDirection() < 0) above = true;
				}
				var end = function(k) {
					return drawn[k] && above && drawn[k].getStemDirection() > 0 && events[k].dur !== "w" ? "nearTop" : "nearHead";
				};
				var dir = (to || from).getStemDirection();
				// A short slur arches less, so it doesn't hook over its notes
				var x0 = from ? from.getAbsoluteX() : to.getStave().getNoteStartX();
				var x1 = to ? to.getAbsoluteX() : from.getStave().getNoteEndX();
				var arch = Math.max(4, Math.min(10, (x1 - x0) / 8));
				try {
					// (half a slur keeps one height to the line's edge)
					var p0 = end(from ? slurFrom : i), p1 = end(to ? i : slurFrom);
					new VF.Curve(from, to, { position: p0, position_end: p1, invert: above ? dir > 0 : dir < 0,
						cps: [{ x: 0, y: arch }, { x: 0, y: arch }] })
						.setContext(context).draw();
				} catch (err) {
					console.log("Could not draw a slur:", i, err.message);
				}
			}
			slurFrom = -1;
		}
		if (e.slurStart) slurFrom = i;
	});

	var svg = out.querySelector("svg");
	if (svg && result.stave) {
		var center = (result.stave.getYForLine(0) + result.stave.getYForLine(4)) / 2;
		svg.setAttribute("viewBox", "0 " + (center - H / 2) + " " + W + " " + H);
		svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
		svg.style.width = "100%";
		svg.style.height = "100%";
		if (arrowAt) drawSongArrow(svg, arrowAt, center - H / 2);
		marksAt.forEach(function(at) { drawSongMark(svg, at, center - H / 2); });
	}
	result.svg = svg;
	result.width = W;
	result.height = H;
	return result;
}

// A downward arrow just above a note (or the staff, whichever is higher),
// kept inside the viewBox (which starts at viewTop)
function drawSongArrow(svg, at, viewTop) {
	var ARROW_H = 22, GAP = 5;
	var tip = Math.max(at.top - GAP, viewTop + ARROW_H + 1);
	var ns = "http://www.w3.org/2000/svg";
	var g = document.createElementNS(ns, "g");
	g.setAttribute("class", "song-arrow");
	var path = document.createElementNS(ns, "path");
	path.setAttribute("d", "M" + at.x + " " + tip +
		" l-9 -10 h5.5 v-12 h7 v12 h5.5 z");
	path.setAttribute("fill", at.color || "currentColor");
	path.setAttribute("stroke-linejoin", "round");
	g.appendChild(path);
	svg.appendChild(g);
}

// A word just above a note (or the staff), kept inside the viewBox
function drawSongMark(svg, at, viewTop) {
	var text = document.createElementNS("http://www.w3.org/2000/svg", "text");
	text.setAttribute("class", "song-mark");
	text.setAttribute("x", at.x);
	text.setAttribute("y", Math.max(at.top - 4, viewTop + 11));
	text.setAttribute("text-anchor", "middle");
	text.setAttribute("font-size", "11");
	text.setAttribute("font-weight", "700");
	text.setAttribute("fill", at.color || "currentColor");
	text.textContent = at.text;
	svg.appendChild(text);
}

// The whole song at once (every line stacked, scrolling) or one line at a
// time, for songs and the editor; remembered per browser
var SONG_WHOLE_STORAGE_KEY = "pitchdetect-song-whole";
var SONG_WHOLE_LINE_HEIGHT = 100;  // tighter than a lone line; ledger notes may overhang
var songWholeView = false;
try { songWholeView = localStorage.getItem(SONG_WHOLE_STORAGE_KEY) === "1"; } catch (e) {}

// Draw a song into out: line alone, or with the whole song showing, every
// line stacked with line scrolled into view (opts.through: only the lines
// up to line, so what came before stays in view). Returns the layouts by line.
function renderSongView(out, song, events, line, measures, opts, color) {
	var layouts = {};
	if (!songWholeView && !opts.whole && !opts.through) {
		layouts[line] = renderSongLine(out, song, events, line, measures, opts, color);
		return layouts;
	}
	var scroll = out.scrollTop;
	out.innerHTML = "";
	var perLine = opts.perLine || SONG_MEASURES_PER_LINE;
	var lineOpts = {};
	Object.keys(opts).forEach(function(k) { lineOpts[k] = opts[k]; });
	lineOpts.height = SONG_WHOLE_LINE_HEIGHT;
	var lines = opts.through ? line + 1 : Math.ceil(measures / perLine);
	for (var l = 0; l < lines; l++) {
		var div = document.createElement("div");
		div.className = "song-line" + (l === line ? " current" : "");
		div.setAttribute("data-line", l);
		out.appendChild(div);
		var r = renderSongLine(div, song, events, l, measures, lineOpts, color);
		div.style.aspectRatio = r.width + " / " + r.height;
		layouts[l] = r;
	}
	out.scrollTop = scroll;
	// Bring the current line into view (only as far as it takes). Following
	// along (opts.ahead), the next line has to show too, before it's reached:
	// once it doesn't, the current line goes to the top, turning the page.
	// Then lines count by what's drawn, not their blank headroom.
	var el = out.querySelector(".song-line.current");
	if (el) {
		var cur = opts.ahead ? songLineInk(el) : { top: el.offsetTop, bottom: el.offsetTop + el.offsetHeight };
		var view = out.scrollTop + out.clientHeight;
		var next = opts.ahead && el.nextElementSibling ? songLineInk(el.nextElementSibling) : null;
		var to = cur.top < out.scrollTop || (next && next.bottom > view) ? cur.top - 6
			: cur.bottom > view ? cur.bottom - out.clientHeight + 6 : null;
		if (to !== null) to = Math.max(0, Math.min(to, out.scrollHeight - out.clientHeight));
		// (A screen too short for both lines stays put with the current one on top)
		if (to !== null && Math.abs(to - out.scrollTop) > 1) {
			var smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
			out.scrollTo({ top: to, behavior: smooth ? "smooth" : "auto" });
		}
	}
	return layouts;
}

// Where a stacked line's notes and staff are drawn: { top, bottom } in its
// scroller's coordinates (the whole line, if it can't be measured)
function songLineInk(el) {
	var top = el.offsetTop, bottom = top + el.offsetHeight;
	var svg = el.querySelector("svg");
	var box = svg && svg.viewBox && svg.viewBox.baseVal;
	if (!box || !box.height) return { top: top, bottom: bottom };
	try {
		var ink = svg.getBBox(), scale = el.offsetHeight / box.height;
		if (!ink.height) return { top: top, bottom: bottom };
		return { top: top + (ink.y - box.y) * scale, bottom: top + (ink.y + ink.height - box.y) * scale };
	} catch (e) {
		return { top: top, bottom: bottom };
	}
}

var WHOLE_SONG_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">' +
	'<rect x="4" y="2.5" width="16" height="19" rx="2.5"/><path d="M8 7.5h8M8 11.5h8M8 15.5h8"/></svg>';

// The button that switches between the whole song and one line
function songViewButton() {
	var b = document.createElement("button");
	b.className = "editor-tool song-view-toggle";
	b.innerHTML = WHOLE_SONG_SVG;
	b.onclick = toggleSongView;
	updateSongViewButton(b);
	return b;
}

function updateSongViewButton(b) {
	var label = songWholeView ? "Show one line at a time" : "Show the whole song";
	b.setAttribute("aria-label", label);
	b.title = label;
	b.setAttribute("aria-pressed", songWholeView ? "true" : "false");
}

// Crossing the wide screen's width redraws the song on its new lines
function onWideSongChange(q) {
	SONG_MEASURES_PER_LINE = q.matches ? 4 : 2;
	if (!practiceOpen || !practice) return;
	if (practice.mode === "song" && practice.song) {
		if (practice.song.pick) drawSongPicker(-1);
		else drawSongLine(practice.song.pos);
	}
}
if (WIDE_SONG_QUERY.addEventListener) WIDE_SONG_QUERY.addEventListener("change", onWideSongChange);
else if (WIDE_SONG_QUERY.addListener) WIDE_SONG_QUERY.addListener(onWideSongChange);

function toggleSongView() {
	songWholeView = !songWholeView;
	try { localStorage.setItem(SONG_WHOLE_STORAGE_KEY, songWholeView ? "1" : "0"); } catch (e) {}
	document.getElementById("practice-view").setAttribute("data-whole", songWholeView ? "1" : "0");
	document.querySelectorAll(".song-view-toggle").forEach(updateSongViewButton);
	stopSongPlayback();
	document.getElementById("practice-staff-output").scrollTop = 0;
	if (practice.mode === "song") drawSongLine(practice.song.pos);
	else if (practice.mode === "editor") drawEditor();
}

// Play a song's events (notes and rests) from the start at SONG_TEMPO with
// the instrument's sound, calling show(i) as each begins. The mic ignores it
// while it plays; stopSongPlayback() ends it. opts (optional): tempo; piano,
// a piano part and metronome to play along (songBacking()); silent, no tune (Play
// along); countIn, pulses (opts.pulse beats each) to count first, calling
// onCount(n) on each; onEnd, called once the last event has played (not
// when stopped).
function playSongEvents(events, show, opts) {
	opts = opts || {};
	var beatMs = 60000 / (opts.tempo || SONG_TEMPO);
	var piano = opts.piano || [];
	var i = 0, beat = 0, h = 0, count = 0;
	if (piano.length || opts.countIn) startAccompaniment();
	function next() {
		if (i >= events.length) {
			// The last chord rings on; the mic waits it out
			var ring = accompNodes.length ? ACCOMP_RING_MS : 0;
			accompNodes = [];
			if (opts.onEnd) opts.onEnd();
			stopSongPlayback();
			if (ring && practice) practice.ignoreUntil = performance.now() + ring;
			return;
		}
		var e = events[i];
		var beats = eventBeats(e);
		var ms = beats * beatMs;
		practice.ignoreUntil = performance.now() + ms + 600;
		show(i);
		// End each note just before the next (a tongued gap, which also
		// keeps repeated notes distinct) so nothing is cut off mid-sound.
		// (a tied note sounds on from the one before; a note slurred into
		// the next is held right up to it, and the next crossfades from it)
		if (e.midi !== null && !opts.silent && !(e.tied && i > 0)) {
			var secs = tiedBeats(events, i) * beatMs / 1000;
			var after = i + 1;
			while (after < events.length && events[after].tied && events[after - 1].tie) after++;
			var slurOn = after < events.length && events[after].legato;
			playTone(frequencyFromNoteNumber(e.midi - getTransposition()), false, null,
				slurOn ? secs + LEGATO_OVERLAP : Math.max(0.1, secs - TONE_RELEASE), e.legato && i > 0);
		}
		// The piano's chords during this note, timed on the audio clock
		for (; h < piano.length && piano[h].beat < beat + beats - 1e-6; h++) {
			playPianoHit(piano[h], (piano[h].beat - beat) * beatMs / 1000, beatMs / 1000);
		}
		beat += beats;
		i++;
		songPlayTimer = setTimeout(next, ms);
	}
	function countIn() {
		if (count >= opts.countIn) {
			next();
			return;
		}
		var ms = opts.pulse * beatMs;
		practice.ignoreUntil = performance.now() + ms + 600;
		count++;
		opts.onCount(count);
		playPianoHit({ midis: [count === 1 ? 96 : 91], len: 0.2, gain: ACCOMP_CLICK_GAIN }, 0, beatMs / 1000);
		songPlayTimer = setTimeout(countIn, ms);
	}
	if (opts.countIn) countIn(); else next();
}

// Hear the song: play the whole tune, the staff and the fingering chart
// following along
function playSong() {
	if (practice.song.free && (practice.song.pos > 0 || practice.song.follow.listening)) {
		resetFollow();
		songMicOff();
	}
	var hear = document.getElementById("song-hear");
	if (hear) hear.textContent = "\u25a0 Stop";
	// A part plays just its measures
	var part = songPart(practice.song);
	var start = 0, events = practice.song.events;
	if (part) {
		var range = songPartEvents(practice.song, part);
		start = range.start;
		events = events.slice(range.start, range.end);
	}
	var showFingering = showSongFingerings(events);
	playSongEvents(events, function(i) {
		if (practice.song.pick) drawSongPicker(start + i);
		else drawSongEvent(start + i);
		showFingering(i);
	}, { piano: songBacking(practice.song.song, events) });
}

// Play along: just the piano, at the speed picked (songSpeed) and after a
// measure counted in, the staff and fingering following the tune, for the
// student to play it over. Each note is scored in time (alongNote()), and
// the result (finishAlong()) can open the next speed.
function playAlong() {
	var s = practice.song;
	clearTimeout(practiceAdvanceTimer);
	if (s.pos > 0 || s.follow.listening) resetFollow();
	songMicOn();
	var speed = ALONG_SPEEDS[alongSpeedIndex()];
	// times: when each event started; bleed: the count-in's loudest level
	var a = s.along = { speed: speed, times: [], played: 0, bleed: 0, ended: false, done: false };
	s.results = s.notes.map(function() { return null; });
	s.timing = s.notes.map(function() { return null; });
	s.played = s.notes.map(function() { return null; });
	// The count-in's clicks (when each was played) and how long each took
	// to reach the mic (alongClickRise())
	a.clicks = [];
	a.quiet = [];
	a.rise = [];
	songPlayAlong = true;
	var along = document.getElementById("song-along");
	if (along) along.textContent = "\u25a0 Stop";
	var time = s.song.time || "4/4";
	var pulse = time.split("/")[1] === "8" ? 1.5 : 1;
	var pulses = Math.round(measureBeats(time) / pulse);
	// The count-in measures the piano at the mic, so the mic has to be on
	// first
	if (!listenActive && listenStarting) {
		setPracticeFeedback("Get ready\u2026", " ");
		var waited = 0;
		(function wait() {
			setTimeout(function() {
				if (practice.mode !== "song" || practice.song !== s || s.along !== a) return;
				waited += 50;
				if (listenStarting && waited < 5000) wait(); else countInAlong(s, a, pulse, pulses);
			}, 50);
		})();
	} else {
		countInAlong(s, a, pulse, pulses);
	}
	updateSpeedPicker();
}

// Play along's count-in, then the piano part with the staff and fingering
// following the tune
function countInAlong(s, a, pulse, pulses) {
	var showFingering = showSongFingerings(s.events);
	playSongEvents(s.events, function(i) {
		if (i === 0) {
			setPracticeFeedback("Play!", "Play along with the piano");
			alongStartLag(a);
		}
		a.times[i] = performance.now();
		drawSongEvent(i);
		showFingering(i);
	}, {
		tempo: a.speed.tempo, piano: songBacking(s.song, s.events), silent: true,
		// Short measures count two
		countIn: pulses < 3 ? pulses * 2 : pulses, pulse: pulse,
		onCount: function(n) {
			a.clicks.push(performance.now());
			setPracticeFeedback(String((n - 1) % pulses + 1), "Get ready\u2026");
		},
		// The last note may still be sounding: listen a moment longer
		onEnd: function() {
			a.ended = true;
			var beatMs = 60000 / a.speed.tempo;
			practiceAdvanceTimer = setTimeout(function() { finishAlong(false); }, 2 * alongTolerance(beatMs) + alongLag(a) + 100);
		}
	});
}

// Play along again at a speed
function startAlong(id) {
	songSpeed = id;
	resetFollow();
	playAlong();
}

// When event ev of a song's Play along starts (performance.now() time):
// as shown, or for one still to come, from the last one shown. null before
// the first.
function alongEventTime(s, ev, beatMs) {
	var a = s.along, k = ev;
	while (k >= 0 && a.times[k] === undefined) k--;
	if (k < 0) return null;
	var t = a.times[k];
	for (; k < ev; k++) t += eventBeats(s.events[k]) * beatMs;
	return t;
}

// Play along's timing at a tempo: a note is on time within a sixteenth of
// the beat (at least ALONG_ON_TIME_MIN_MS) of its start, and still counts,
// as early or late, within twice that
function alongTolerance(beatMs) {
	return Math.max(ALONG_ON_TIME_MIN_MS, beatMs / 4);
}

// How long after an event is shown a note played right on it is heard
// (a.lag, from alongStartLag()): measured from the count-in's clicks, else
// the timing check's, else a guess: the piano sounds 50 ms later
// (playPianoHit()), then the speakers' own delay, then the mic's
function alongLag(a) {
	if (a && a.lag) return a.lag;
	var out = 0;
	try {
		out = audioContext ? audioContext.outputLatency || audioContext.baseLatency || 0 : 0;
	} catch (e) {}
	return 50 + out * 1000 + ALONG_LATENCY_MS;
}

// A note played during Play along, starting at onset: of the song notes
// not yet played whose window (alongTolerance() × 2 either side of their
// start) holds it, it counts for the one it sounds most like (heardAs():
// right, an octave off, then low or high), the nearest of those: early or
// late (s.timing) when off by more than the tolerance. Else it's wrong on
// the nearest. Right notes on time turn green as they go, the rest orange.
function alongNote(pitch, onset) {
	var s = practice.song, a = s.along;
	var beatMs = 60000 / a.speed.tempo;
	var tol = alongTolerance(beatMs);
	var lag = alongLag(a);
	var RANK = { right: 0, octave: 1, low: 2, high: 2 };
	var match = -1, matchRank = 0, matchOff = 0, wrong = -1, wrongOff = Infinity;
	a.played++;
	for (var j = 0; j < s.notes.length; j++) {
		var start = alongEventTime(s, s.notes[j].event, beatMs);
		if (start === null) break;
		var off = onset - start - lag;
		if (off < -2 * tol) break;
		var r = s.results[j];
		if (off > 2 * tol || (r && r !== "wrong")) continue;
		var heard = heardAs(pitch, s.notes[j].midi);
		if (heard !== "wrong") {
			var rank = RANK[heard];
			if (match < 0 || rank < matchRank || (rank === matchRank && Math.abs(off) < Math.abs(matchOff))) {
				match = j;
				matchRank = rank;
				matchOff = off;
			}
		} else if (Math.abs(off) < wrongOff) {
			wrong = j;
			wrongOff = Math.abs(off);
		}
	}
	if (match >= 0) {
		s.results[match] = heardAs(pitch, s.notes[match].midi);
		s.played[match] = pitch;
		s.timing[match] = matchOff < -tol ? "early" : matchOff > tol ? "late" : null;
	} else if (wrong >= 0) {
		s.results[wrong] = "wrong";
		s.played[wrong] = pitch;
	}
	if (!a.ended) drawSongEvent(a.times.length - 1);
}

// The count-in's clicks: how long each takes to reach the mic. Before the
// click can sound (it plays 50 ms late) the mic's level is the quiet; the
// first frame clearly louder is the click heard. Energy in the analysis
// window grows in step with the time since the sound arrived, so the next
// frame's level, extrapolated back, says when it did.
function alongClickRise(a, now, level) {
	var k = a.clicks.length - 1;
	var prev = a.lastFrame;
	a.lastFrame = now;
	if (k < 0 || a.rise[k] !== undefined) return;
	var since = now - a.clicks[k];
	if (a.quiet[k] === undefined) {
		if (since < 40) a.quiet[k] = level; else a.rise[k] = null;
		return;
	}
	var q = a.quiet[k], up = a.up;
	if (up && up.k === k) {
		var e1 = up.level * up.level - q * q, e2 = level * level - q * q;
		var at = e2 > e1 ? up.at - e1 * (now - up.at) / (e2 - e1) : up.at;
		a.rise[k] = Math.max(up.prev, Math.min(up.at, at)) - a.clicks[k];
		a.up = null;
	} else if (since > ALONG_MAX_LAG_MS) {
		a.rise[k] = null;
	} else if (level > Math.max(q * ALONG_CLICK_RISE, q + ALONG_CLICK_MIN_RISE)) {
		a.up = { k: k, at: now, prev: prev === undefined ? now : prev, level: level };
	}
}

// Play along's delay (alongLag()), set as the count-in ends: from its clicks
// if the mic heard them alike (speakers), else the last timing check on
// this device, else a guess. a.lagFrom says which.
function alongStartLag(a) {
	var rises = a.rise.filter(function(r) { return typeof r === "number"; }).sort(function(x, y) { return x - y; });
	var mid = rises.length ? rises[Math.floor(rises.length / 2)] : null;
	var agree = rises.filter(function(r) { return Math.abs(r - mid) <= ALONG_CLICK_AGREE_MS; }).length;
	var checked = storedTimingCheck();
	if (mid !== null && agree >= Math.max(2, a.clicks.length / 2)) {
		a.lag = mid + ALONG_PITCH_DELAY_MS;
		a.lagFrom = "clicks";
	} else if (checked) {
		a.lag = checked;
		a.lagFrom = "check";
	} else {
		a.lag = alongLag(null);
		a.lagFrom = "guess";
	}
}

// The timing check's delay on this device (ms), or null
function storedTimingCheck() {
	var lag = null;
	try { lag = parseFloat(localStorage.getItem(TIMING_CHECK_STORAGE_KEY)); } catch (e) {}
	return lag > 0 && lag <= ALONG_MAX_LAG_MS ? lag : null;
}

// The timing check (for headphones, whose clicks the mic can't hear): a few
// clicks to listen to, then a short note on each of TIMING_CHECK_CLICKS.
// How long after each click the note is heard is the whole delay Play
// along has to allow: speakers, the student hearing and playing, the mic.
function startTimingCheck() {
	var s = practice.song;
	stopSongPlayback();
	resetFollow();
	var c = s.check = { clicks: [], onsets: [], done: false };
	var beatMs = 60000 / TIMING_CHECK_TEMPO;
	songMicOn();
	setPracticeFeedback(TIMING_CHECK_LABEL, "Get ready…");
	var actions = document.querySelector("#practice-body .practice-actions");
	actions.innerHTML = "";
	actions.appendChild(practiceButton("■ Stop", "secondary", stopTimingCheck));
	var n = 0, waited = 0;
	(function tick() {
		if (practice.mode !== "song" || practice.song !== s || s.check !== c) return;
		// The mic first
		if (listenStarting && waited < 5000) {
			waited += 50;
			songPlayTimer = setTimeout(tick, 50);
			return;
		}
		if (n === 0) startAccompaniment();
		if (n >= TIMING_CHECK_COUNT_IN + TIMING_CHECK_CLICKS) {
			songPlayTimer = setTimeout(finishTimingCheck, beatMs);
			return;
		}
		n++;
		var play = n > TIMING_CHECK_COUNT_IN;
		if (play) c.clicks.push(performance.now());
		setPracticeFeedback(play ? "Play!" : String(n), play ? "One short note on each click" : "Listen to the clicks…");
		playPianoHit({ midis: [(n - 1) % 4 === 0 ? 96 : 91], len: 0.2, gain: ACCOMP_CLICK_GAIN }, 0, beatMs / 1000);
		songPlayTimer = setTimeout(tick, beatMs);
	})();
}

function timingCheckNote(onset) {
	var c = practice.song.check;
	if (c && c.clicks.length) c.onsets.push(onset);
}

function stopTimingCheck() {
	practice.song.check = null;
	stopSongPlayback();
	songMicOff();
	resetFollow();
}

// The timing check's result: the middle of the delays from each click to
// the note played on it, kept for this device if they agree
function finishTimingCheck() {
	var s = practice.song, c = s.check;
	songPlayTimer = null;
	if (!c || c.done) return;
	c.done = true;
	stopAccompaniment();
	songMicOff();
	var beatMs = 60000 / TIMING_CHECK_TEMPO, offs = [];
	c.clicks.forEach(function(t) {
		var o = c.onsets.find(function(x) { return x - t >= -TIMING_CHECK_EARLY_MS && x - t < beatMs - TIMING_CHECK_EARLY_MS; });
		if (o !== undefined) offs.push(o - t);
	});
	offs.sort(function(x, y) { return x - y; });
	var n = offs.length, lag = n ? offs[Math.floor(n / 2)] : null;
	var ok = n > TIMING_CHECK_CLICKS / 2 && lag > 0 && lag <= ALONG_MAX_LAG_MS &&
		offs[Math.ceil(n * 3 / 4) - 1] - offs[Math.floor(n / 4)] <= TIMING_CHECK_SPREAD_MS;
	resetFollow();
	if (ok) {
		try { localStorage.setItem(TIMING_CHECK_STORAGE_KEY, String(Math.round(lag))); } catch (e) {}
		setPracticeFeedback("Timing set ✓", "Play along now allows " + Math.round(lag) + " ms for your speakers and mic", "good");
	} else {
		setPracticeFeedback("I couldn’t tell", c.onsets.length ? "Play one short note right on each click" : "No notes heard: play one short note on each click", "close");
		var actions = document.querySelector("#practice-body .practice-actions");
		actions.insertBefore(practiceButton("Try again", "primary", startTimingCheck), actions.firstChild);
	}
}

// What the mic heard for song note j, for its tapped name: "You played
// E♭", "A bit low", "Not heard", "A bit late"...; "" if it was right
function songHeardText(s, j) {
	var r = s.results[j], played = s.played ? s.played[j] : null, midi = s.notes[j].midi;
	var words = [];
	if (r === "wrong" && played !== null) words.push("You played " + practiceNoteName(Math.round(played)));
	else if (r === "octave" && played !== null) words.push("An octave " + (played > midi ? "up" : "down"));
	else if (r === "low" || r === "high") words.push("A bit " + r);
	else if (r === "missed") words.push("Not heard");
	var t = s.along && s.timing ? s.timing[j] : null;
	if (t) words.push((words.length ? "a bit " : "A bit ") + t);
	return words.join(", ");
}

// A tapped wrong (or octave) note's ghost: what was played, beside it
function songTappedGhost(s) {
	if (!s.done || s.tapped === null || s.tapped === undefined || !s.played) return null;
	var j = s.notes.findIndex(function(n) { return n.event === tieStart(s.events, s.tapped); });
	var r = j >= 0 ? s.results[j] : null;
	return (r === "wrong" || r === "octave") && s.played[j] !== null ? Math.round(s.played[j]) : null;
}

// The words over a song's orange notes, by event (renderSongLine()'s
// marks): "low" / "high" (out of tune), Play along's "early" / "late"
function songOffMarks(s) {
	var marks = {};
	s.notes.forEach(function(n, j) {
		var r = s.results[j], t = s.along && s.timing ? s.timing[j] : null;
		var words = [r === "low" || r === "high" ? r : null, t].filter(Boolean);
		if (words.length) marks[n.event] = words.join(" \u00b7 ");
	});
	return marks;
}

// The orange notes counted: "2 low, 1 late", or "" for none
function songOffText(s) {
	var counts = { low: 0, high: 0, early: 0, late: 0 };
	s.notes.forEach(function(n, j) {
		if (s.results[j] === "low" || s.results[j] === "high") counts[s.results[j]]++;
		if (s.along && s.timing && s.timing[j]) counts[s.timing[j]]++;
	});
	return Object.keys(counts).filter(function(k) { return counts[k]; })
		.map(function(k) { return counts[k] + " " + k; }).join(", ");
}

// The end of Play along: the song in green and red, a score at that speed
// (best kept per speed, and for the song), and the next speed once this one
// is passed. partway: Stop and score before the end, so only the notes
// already gone by count and nothing is saved.
function finishAlong(partway) {
	var s = practice.song, a = s.along;
	if (!a || a.done || practice.mode !== "song") return;
	a.done = a.ended = true;
	clearTimeout(practiceAdvanceTimer);
	stopSongPlayback();
	var now = performance.now(), beatMs = 60000 / a.speed.tempo;
	var late = 2 * alongTolerance(beatMs) + alongLag(a);
	s.notes.forEach(function(n, j) {
		var start = alongEventTime(s, n.event, beatMs);
		var gone = start !== null && start + late < now;
		if (!s.results[j] && (!partway || gone)) s.results[j] = "missed";
	});
	var total = s.notes.length;
	s.done = true;
	s.pos = total;
	practice.step = 4;
	drawSongLine(s.pos);
	if (practiceStartedMic && listenActive) stopListening();
	practiceStartedMic = false;

	var speed = a.speed, k = ALONG_SPEEDS.indexOf(speed), next = ALONG_SPEEDS[k + 1];
	// Early, late, low and high notes (orange) don't score
	var right = s.results.filter(function(r, j) { return (r === "right" || r === "octave") && !s.timing[j]; }).length;
	var firstMiss = s.results.findIndex(function(r) { return r === "wrong" || r === "missed"; });
	var offText = songOffText(s);
	// Most notes late (or early) by a guessed delay: the speakers' delay
	// may be off, which the timing check measures
	var timed = s.timing.filter(function(t, j) { return s.results[j] && s.results[j] !== "wrong" && s.results[j] !== "missed"; });
	var skewed = a.lagFrom === "guess" && timed.length >= 4 && ["early", "late"].some(function(w) {
		return timed.filter(function(t) { return t === w; }).length >= timed.length / 2;
	});
	var stars = challengeStars(right, total);
	var scored = !partway && a.played > 0;
	var key = songBestKey(s.song);
	var bests = practice.songSpeedBest[key] || {};
	var wasOpen = next && alongSpeedOpen(s.song, k + 1);
	var newBest = scored && (typeof bests[speed.id] !== "number" || right > bests[speed.id]);
	if (newBest) {
		bests[speed.id] = right;
		practice.songSpeedBest[key] = bests;
		saveSongSpeedBest(practice.instrument, practice.songSpeedBest);
	}
	// Played in time with the piano: it counts for the song too
	var prev = practice.songBest[key];
	if (scored && (typeof prev !== "number" || right > prev)) {
		practice.songBest[key] = right;
		saveSongBest(practice.instrument, practice.songBest);
	}
	var nextOpen = next && alongSpeedOpen(s.song, k + 1);

	if (!a.played) {
		setPracticeFeedback("No notes heard", "Play into the mic along with the piano", "close");
	} else {
		setPracticeFeedback(
			speed.icon + " " + (right === total ? "Perfect! " : right + " of " + total + " notes right ") + starText(stars),
			partway ? "You stopped partway through"
				: nextOpen && !wasOpen ? "You unlocked " + next.icon + " " + next.name + " speed!"
				: skewed ? "Lots of notes off the beat? Try the timing check in \u22ef"
				: firstMiss >= 0 && offText ? "Red: missed or wrong \u00b7 orange: " + offText
				: offText ? "Orange notes: " + offText
				: s.results.indexOf("wrong") >= 0 ? "Tap a red note to see what you played"
				: firstMiss >= 0 ? "The red notes were missed or wrong"
				: !next ? "Top speed!" : "\u00a0",
			right === total ? "good" : "close");
	}

	var actions = document.querySelector("#practice-body .practice-actions");
	actions.innerHTML = "";
	// Two buttons at most in the row; the rest wait behind the \u22ef menu
	var faster = scored && nextOpen && stars >= ALONG_PASS_STARS;
	var more = [["Play it through", resetFollow]];
	if (firstMiss >= 0) {
		var red = ["Practice the red notes", function() { startSong(s.id, songLineStart(firstMiss)); }];
		if (faster) more.push(red);
		else actions.appendChild(practiceButton(red[0], "secondary", red[1]));
	}
	var again = [playAlongLabel(speed) + " again", function() { startAlong(speed.id); }];
	if (faster) {
		// The next speed is the step to take; this one again can wait
		more.unshift(again);
		actions.appendChild(practiceButton("Try " + next.icon + " " + next.name + " speed \u2192", "primary", function() {
			startAlong(next.id);
		}));
	} else {
		actions.appendChild(practiceButton(again[0], "primary", again[1]));
	}
	more.push(["Pick a part", function() {
		var m = firstMiss >= 0 ? s.notes[firstMiss].measure : null;
		showSongPicker(s.id, function() { playThroughSong(s.id); }, m === null ? null : { a: m, b: m });
	}]);
	more.push(["Note by note", function() { startSong(s.id); }]);
	more.push([TIMING_CHECK_LABEL, startTimingCheck]);
	actions.appendChild(songMoreMenu(more));
	if (scored && stars > 0) addPathNextButton(actions);
	updateSpeedPicker();
	if (right === total && scored) launchFireworks(document.getElementById("practice-stage"));
	if (scored) recordProgress(10 + 2 * right + (right === total ? 15 : 0) + speed.xp + (newBest && right > 0 ? NEW_BEST_XP : 0));
}

// Play along's speed picker (in Play it through's settings): a button per speed,
// a lock on the ones not open yet on this song (updateSpeedPicker())
function alongSpeedPicker() {
	var row = document.createElement("div");
	row.className = "speed-picker";
	row.setAttribute("role", "group");
	row.setAttribute("aria-label", "Play along speed");
	ALONG_SPEEDS.forEach(function(speed) {
		var b = document.createElement("button");
		b.className = "speed-choice";
		b.innerHTML = '<span class="speed-icon" aria-hidden="true"></span><span class="speed-name"></span>';
		b.onclick = function() {
			songSpeed = speed.id;
			updateSpeedPicker();
		};
		row.appendChild(b);
	});
	return row;
}

function updateSpeedPicker() {
	var row = document.querySelector("#practice-steps .speed-picker");
	var s = practice && practice.song;
	if (!row || !s) return;
	// A speed not open on this song falls back to the fastest that is
	var k = alongSpeedIndex();
	while (k > 0 && !alongSpeedOpen(s.song, k)) k--;
	songSpeed = ALONG_SPEEDS[k].id;
	var playing = songPlayTimer !== null || (s.along && !s.along.done);
	var along = document.getElementById("song-along");
	if (along && !songPlayAlong) along.textContent = playAlongLabel();
	row.querySelectorAll(".speed-choice").forEach(function(b, i) {
		var speed = ALONG_SPEEDS[i], open = alongSpeedOpen(s.song, i);
		b.querySelector(".speed-icon").textContent = open ? speed.icon : "\ud83d\udd12";
		b.querySelector(".speed-name").textContent = speed.name;
		b.disabled = !open || playing;
		b.setAttribute("aria-pressed", i === k ? "true" : "false");
		var label = open ? speed.name + " speed" : speed.name + " speed: play along at " + ALONG_SPEEDS[i - 1].name + " speed to open it";
		b.title = label;
		b.setAttribute("aria-label", label);
	});
}

function alongSpeedIndex() {
	var k = ALONG_SPEEDS.findIndex(function(speed) { return speed.id === songSpeed; });
	return k < 0 ? 1 : k;
}

// Whether Play along offers speed k on a song: Turtle and Walk always (and
// every speed to a teacher), each faster one once the one before it has
// ALONG_PASS_STARS
function alongSpeedOpen(song, k) {
	if (k <= 1 || teacherMode) return true;
	var best = (practice.songSpeedBest[songBestKey(song)] || {})[ALONG_SPEEDS[k - 1].id];
	return typeof best === "number" && challengeStars(best, songNotes(song).length) >= ALONG_PASS_STARS;
}

// The fastest speed a song has been played along at with ALONG_PASS_STARS
// (an index into ALONG_SPEEDS), or -1
function alongSpeedPassed(song) {
	var best = practice.songSpeedBest[songBestKey(song)] || {};
	var total = songNotes(song).length;
	for (var k = ALONG_SPEEDS.length - 1; k >= 0; k--) {
		var n = best[ALONG_SPEEDS[k].id];
		if (typeof n === "number" && challengeStars(n, total) >= ALONG_PASS_STARS) return k;
	}
	return -1;
}

// ---------------------------------------------------------------------------
// Piano accompaniment for Hear the song and Play along: an oom-pah part (a
// bass note on the first beat of each chord, the chord on the beats after),
// its chords picked from the tune itself: I, IV, V(7), vi or ii of the
// song's key (songTonic()), one per half measure in 4/4, else per measure.
// It sounds through its own nodes (accompNodes), so each note of the tune
// (playTone() stops the last) leaves it ringing.
// ---------------------------------------------------------------------------

var ACCOMP_CHORDS = [  // semitones above the tonic; bias: how readily it's picked
	{ root: 0, tones: [0, 4, 7], bias: 0.3 },   // I
	{ root: 5, tones: [5, 9, 0], bias: 0.1 },   // IV
	{ root: 7, tones: [7, 11, 2], bias: 0.2 },  // V
	{ root: 9, tones: [9, 0, 4], bias: -0.2 },  // vi
	{ root: 2, tones: [2, 5, 9], bias: -0.4 }   // ii
];
var ACCOMP_CHORD_GAIN = 0.05;   // per chord note; the tune plays at ~0.2
var ACCOMP_BASS_GAIN = 0.09;
var ACCOMP_CLICK_GAIN = 0.06;   // Play along's count-in and the metronome
var ACCOMP_RING_MS = 1500;      // the last chord's ring after the tune ends
// Play along's speeds (quarter notes per minute; Walk is the old one).
// Turtle and Walk are always open; each faster one opens on a song once the
// one before it has ALONG_PASS_STARS there. xp: extra for a run at it.
var ALONG_SPEEDS = [
	{ id: "turtle", name: "Turtle", icon: "\ud83d\udc22", tempo: 60, xp: 0 },
	{ id: "walk", name: "Walk", icon: "\ud83d\udeb6", tempo: 80, xp: 0 },
	{ id: "bunny", name: "Bunny", icon: "\ud83d\udc07", tempo: 100, xp: 5 },
	{ id: "rocket", name: "Rocket", icon: "\ud83d\ude80", tempo: 120, xp: 10 }
];
var ALONG_PASS_STARS = 2;
var ALONG_ON_TIME_MIN_MS = 100;  // on time: within a sixteenth of the beat, never tighter than this
var ALONG_LATENCY_MS = 60;     // a note reaches the pitch detector about this long after it starts
var ALONG_PITCH_DELAY_MS = 25;  // a note's pitch is found about this long after its loudness rises
var ALONG_CLICK_RISE = 2;       // the mic's level this many times the quiet before a click: it's heard
var ALONG_CLICK_MIN_RISE = 0.002;  // ...and up by at least this much
var ALONG_CLICK_AGREE_MS = 30;  // the count-in's clicks measured within this of each other
var ALONG_MAX_LAG_MS = 600;     // a longer delay than this isn't believed
var TIMING_CHECK_TEMPO = 80;
var TIMING_CHECK_COUNT_IN = 4;  // clicks to listen to, then...
var TIMING_CHECK_CLICKS = 8;    // ...clicks to play a note on
var TIMING_CHECK_EARLY_MS = 150;   // a note this early still counts for a click
var TIMING_CHECK_SPREAD_MS = 120;  // the middle half of the notes within this, or try again
var TIMING_CHECK_IGNORE_MIDI = 88; // concert; the clicks (91, 96) aren't the student's notes
var TIMING_CHECK_STORAGE_KEY = "pitchdetect-along-lag";  // per device: its speakers and mic
var TIMING_CHECK_LABEL = "\u23f1 Timing check";
var ALONG_BLEED_FACTOR = 2.5;  // the piano's chords at the mic, against the count-in's click
var ALONG_GATE_MAX = 0.04;     // never ask for a level (RMS) above this to beat the piano
var SONG_SPEED_STORAGE_KEY = "pitchdetect-song-speeds";
var songSpeed = "walk";        // Play along's speed, for this visit
// A lighter piano than the main app's (no doubled strings, fewer partials):
// chords on every beat would otherwise mean hundreds of oscillators
var ACCOMP_TIMBRE = Object.assign({}, instrumentTimbres["default"], {
	harmonics: instrumentTimbres["default"].harmonics.slice(0, 5), detuneSpread: 0, strikeNoise: 0.15
});
var accompNodes = [];      // the piano's gain nodes still sounding: [{ gain, end }]
var songPlayAlong = false; // Play along (not Hear the song) is playing

// The piano part for a song's events (all of them, or a part's): hits
// [{ beat (from the first event), midis (concert), len (beats), gain }]
function songAccompaniment(song, events) {
	var tonic = songTonic(song);
	var notes = events.filter(function(e) { return e.midi !== null; });
	if (!tonic || tonic.letter < 0 || !notes.length) return [];
	var tonicPc = NATURAL_SEMITONES[tonic.letter] + tonic.alter;
	var time = song.time || "4/4";
	var measure = measureBeats(time);
	var pulse = time.split("/")[1] === "8" ? 1.5 : 1;
	var segLen = measure === 4 ? 2 : measure;
	var starts = [], total = 0;
	events.forEach(function(e) {
		starts.push(total);
		total += eventBeats(e);
	});

	// How long each note (as degrees of the key, 0–11) sounds in each
	// segment; a note sounding as the chord starts counts double
	// Segments start every segLen beats; the last one runs from where the
	// last note starts to the end: its chord is the last chord
	var lastNote = events.lastIndexOf(notes[notes.length - 1]);
	var lastSeg = Math.floor((starts[lastNote] + 1e-6) / segLen) * segLen;
	var bounds = [];
	for (var b = 0; b < lastSeg - 1e-6; b += segLen) bounds.push(b);
	bounds.push(lastSeg, total);
	var segs = [];
	bounds.slice(0, -1).forEach(function(a, s) {
		var z = bounds[s + 1], w = null;
		events.forEach(function(e, i) {
			if (e.midi === null) return;
			var on = Math.min(z, starts[i] + eventBeats(e)) - Math.max(a, starts[i]);
			if (on <= 0) return;
			var pc = (((e.midi - tonicPc) % 12) + 12) % 12;
			w = w || {};
			w[pc] = (w[pc] || 0) + on * (starts[i] <= a + 1e-6 ? 2 : 1);
		});
		segs.push(w);
	});
	// The chord that fits each segment's notes best, held over rests,
	// leaning toward staying put, starting and ending at home
	var chords = [];
	segs.forEach(function(w, s) {
		var prev = s ? chords[s - 1] : null;
		if (!w) {
			chords.push(prev || ACCOMP_CHORDS[0]);
			return;
		}
		// The chord before the last leads home, so I waits for the last
		// note: V, its melody notes heard as leaning into the last
		// ("2q 2q 3q 2q | 1w" stays on V), or IV under a tonic held
		// through it (an "amen" ending)
		if (s === segs.length - 2) {
			var sum = Object.keys(w).reduce(function(t, pc) { return t + w[pc]; }, 0);
			chords.push(ACCOMP_CHORDS[(w[0] || 0) >= 0.75 * sum ? 1 : 2]);
			return;
		}
		var best = null, bestScore = -Infinity;
		ACCOMP_CHORDS.forEach(function(c) {
			var score = c.bias + (c === prev ? 0.25 : 0);
			if (c === ACCOMP_CHORDS[0] && (s === 0 || s === segs.length - 1)) score += s ? 3 : 0.5;
			Object.keys(w).forEach(function(pc) {
				score += c.tones.indexOf(+pc) >= 0 ? w[pc] : -0.7 * w[pc];
			});
			if (score > bestScore) {
				best = c;
				bestScore = score;
			}
		});
		chords.push(best);
	});

	// Voiced under the tune; under a low tune (low brass, tuba) the chords
	// go above it, with no bass to muddy it
	var t = getTransposition();
	var low = Math.min.apply(null, notes.map(function(e) { return e.midi - t; }));
	var bassless = low < 52;
	var chordLo = bassless ? 55 : Math.min(57, Math.max(48, low - 10));
	function place(degree, lo) {
		return lo + (((degree + tonicPc - t - lo) % 12) + 24) % 12;
	}
	var hits = [], onRoot = false;
	chords.forEach(function(c, s) {
		var a = bounds[s], end = bounds[s + 1], last = s === chords.length - 1;
		var tones = c.tones.slice();
		// V gets its seventh when the tune has it, or leads home at the end
		if (c.root === 7 && ((segs[s] && segs[s][5]) || (chords[s + 1] === ACCOMP_CHORDS[0] && s + 2 === chords.length))) {
			tones.push(5);
		}
		var chord = tones.map(function(d) { return place(d, chordLo); });
		// The bass alternates root and fifth while a chord holds
		onRoot = !(s && chords[s - 1] === c && onRoot);
		var bass = place(onRoot ? c.root : c.root + 7, chordLo - 12);
		if (last) {
			// The last chord, whole, ringing out
			hits.push({ beat: a, midis: chord, len: end - a + 1, gain: ACCOMP_CHORD_GAIN });
			if (!bassless) hits.push({ beat: a, midis: [bass], len: end - a + 1, gain: ACCOMP_BASS_GAIN });
			return;
		}
		for (var beat = a; beat < end - 1e-6; beat += pulse) {
			if (beat === a && !bassless) hits.push({ beat: beat, midis: [bass], len: pulse * 1.5, gain: ACCOMP_BASS_GAIN });
			else hits.push({ beat: beat, midis: chord, len: pulse * 0.75, gain: ACCOMP_CHORD_GAIN });
		}
	});
	return hits;
}

// What plays under a song's events (all of them, or a part's): the piano
// part if it's on (songPiano), and the metronome if it's on (songClick),
// as hits like songAccompaniment()'s, in order
function songBacking(song, events) {
	var hits = songPiano ? songAccompaniment(song, events) : [];
	if (songClick) {
		hits = hits.concat(songClicks(song, events)).sort(function(a, b) { return a.beat - b.beat; });
	}
	return hits;
}

// The metronome for a song's events: a click on each beat (a dotted
// quarter in 6/8), higher on each measure's first. A short first measure
// is a pickup, counted back from its bar line.
function songClicks(song, events) {
	var time = song.time || "4/4";
	var measure = measureBeats(time);
	var pulse = time.split("/")[1] === "8" ? 1.5 : 1;
	// Each measure's start and end, in beats from the first event
	var bars = [], beat = 0;
	events.forEach(function(e) {
		var last = bars[bars.length - 1];
		if (!last || last.measure !== e.measure) bars.push(last = { measure: e.measure, start: beat });
		beat += eventBeats(e);
		last.end = beat;
	});
	var hits = [];
	bars.forEach(function(bar, k) {
		var first = k === 0 && bar.end - bar.start < measure - 1e-6 ? bar.end - measure : bar.start;
		for (var t = first; t < bar.end - 1e-6; t += pulse) {
			if (t < bar.start - 1e-6) continue;
			hits.push({ beat: t, midis: [t === first ? 96 : 91], len: 0.2, gain: ACCOMP_CLICK_GAIN });
		}
	});
	return hits;
}

// Get the audio going for the piano, stopping any piano still sounding
function startAccompaniment() {
	stopAccompaniment();
	setAudioSessionType("playback");
	try {
		if (!audioContext || audioContext.state === "closed") {
			audioContext = new (window.AudioContext || window.webkitAudioContext)();
		}
		if (audioContext.state !== "running") audioContext.resume();
	} catch (e) {
		// No audio available
	}
}

// One piano hit, offset seconds from now; beatSec sets its length
function playPianoHit(hit, offset, beatSec) {
	if (!audioContext || audioContext.state === "closed") return;
	try {
		var t = audioContext.currentTime + 0.05 + offset;
		var duration = Math.min(ACCOMP_TIMBRE.duration, hit.len * beatSec + 0.3);
		var timbre = Object.assign({}, ACCOMP_TIMBRE, { duration: duration });
		var gain = audioContext.createGain();
		gain.gain.setValueAtTime(hit.gain, t);
		gain.connect(audioContext.destination);
		hit.midis.forEach(function(midi) {
			synthesizeStruck(frequencyFromNoteNumber(midi), timbre, t, gain, false, []);
		});
		// Only the gains need keeping, to fade; the oscillators stop themselves
		var now = audioContext.currentTime;
		accompNodes = accompNodes.filter(function(n) { return n.end > now; });
		accompNodes.push({ gain: gain, end: t + duration });
	} catch (e) {
		// No audio available
	}
}

// Fade out the piano (Hear the song or Play along stopped)
function stopAccompaniment() {
	var nodes = accompNodes;
	accompNodes = [];
	if (!nodes.length || !audioContext || audioContext.state === "closed") return;
	var now = audioContext.currentTime;
	nodes.forEach(function(n) {
		rampGainToZero(n.gain.gain, now, 0.03);
		setTimeout(function() {
			try { n.gain.disconnect(); } catch (e) {}
		}, 100);
	});
}

// While Hear the song plays, the fingering for each note as it sounds. One
// chart per pitch is built up front (so images are loaded before their note
// comes) and only shown in turn; a rest keeps the last note's fingering, and
// the first note's shows from the start so the student sees where to begin.
// Any Help chart steps aside meanwhile. Returns show(i) for event i.
function showSongFingerings(events) {
	removeSongFingerings();
	if (practice.song) practice.song.tapped = null;
	var body = document.getElementById("practice-body");
	var wrap = document.createElement("div");
	wrap.className = "song-fingering";
	wrap.id = "song-fingering";
	wrap.setAttribute("aria-hidden", "true");
	// The area's height is fixed for the whole song (see the CSS), so a
	// chart of another size can never move the staff above it
	wrap.style.setProperty("--fingering-h", hasFingeringData(practice.instrument)
		? fingeringBoxHeight(practice.instrument) : "134px");
	var boxes = {};
	events.forEach(function(e) {
		if (e.midi === null || boxes[e.midi]) return;
		var box = practiceFingeringBox(true, e.midi, true);
		box.hidden = true;
		boxes[e.midi] = box;
		wrap.appendChild(box);
	});
	if (!wrap.firstChild) return function() {};
	if (practice.instrument === "trombone") {
		centerChartsTogether(Object.keys(boxes).map(function(m) { return boxes[m]; }));
	} else if (practice.instrument === "clarinet") {
		trimClarinetCharts(Object.keys(boxes).map(function(m) { return boxes[m]; }));
	} else if (imageFingeringMap[practice.instrument]) {
		lineUpChartImages(boxes);
	}
	var help = body.querySelector(":scope > .practice-fingering");
	if (help) help.hidden = true;
	body.insertBefore(wrap, body.firstChild);
	// A wide screen puts it beside the staff (see the CSS)
	document.getElementById("practice-view").setAttribute("data-song-charts", "1");
	var shown = null;
	function show(midi) {
		if (shown) shown.hidden = true;
		shown = boxes[midi];
		shown.hidden = false;
	}
	show(events.find(function(e) { return e.midi !== null; }).midi);
	return function(i) {
		if (events[i].midi !== null) show(events[i].midi);
	};
}

// Put away the play-along fingering and bring back any Help chart
function removeSongFingerings() {
	document.getElementById("practice-view").removeAttribute("data-song-charts");
	var wrap = document.getElementById("song-fingering");
	if (!wrap) return;
	var help = wrap.parentNode.querySelector(":scope > .practice-fingering");
	if (help) help.hidden = false;
	wrap.remove();
}

// A tap on a note of a song (not while it plays or a part is being picked):
// that note's fingering, in the chart area Hear the song uses, and the note
// marked. A tap on it again, or off the notes, puts it away. In note by
// note, the note being waited for gets Help instead (so it no longer scores).
function songNoteTap(event) {
	if (!practiceOpen || !practice || practice.mode !== "song" || !practice.song || practice.song.pick) return;
	if (songPlayTimer !== null) return;
	var s = practice.song;
	if (!s.layouts) return;
	var lineEl = event.target.closest ? event.target.closest(".song-line") : null;
	var keys = Object.keys(s.layouts);
	var r = lineEl ? s.layouts[lineEl.getAttribute("data-line")] : keys.length === 1 ? s.layouts[keys[0]] : null;
	var hit = null;
	if (r && r.svg) {
		var pt = r.svg.createSVGPoint();
		pt.x = event.clientX;
		pt.y = event.clientY;
		var x = pt.matrixTransform(r.svg.getScreenCTM().inverse()).x;
		var best = SONG_TAP_REACH;
		Object.keys(r.xs).forEach(function(k) {
			var i = parseInt(k, 10);
			if (s.events[i].midi === null) return;
			var d = Math.abs(r.xs[k] - x);
			if (d < best) {
				best = d;
				hit = i;
			}
		});
	}
	if (!s.free && hit !== null && practice.step === 3 && s.pos < songEnd(s) && tieStart(s.events, hit) === s.notes[s.pos].event) {
		if (!s.helped) showSongHelp();
		return;
	}
	if (hit === null || hit === s.tapped) {
		if (s.tapped === null || s.tapped === undefined) return;
		removeSongFingerings();
		s.tapped = null;
	} else {
		showSongFingerings([s.events[hit]]);
		s.tapped = hit;
		var wrap = document.getElementById("song-fingering");
		// After a run, what was heard for it, if it wasn't right
		var j = s.notes.findIndex(function(n) { return n.event === tieStart(s.events, hit); });
		var heard = s.free && s.done && j >= 0 ? songHeardText(s, j) : "";
		var name = document.createElement("div");
		name.className = "song-fingering-name";
		if (wrap && !hasFingeringData(practice.instrument)) {
			// The keyboard names its key itself
			wrap.removeAttribute("aria-hidden");
			wrap.innerHTML = "";
			wrap.appendChild(practiceFingeringBox(false, s.events[hit].midi));
		} else if (wrap) {
			wrap.removeAttribute("aria-hidden");
			name.textContent = songNoteName(s.events[hit]);
		}
		if (wrap && heard) {
			var said = document.createElement("div");
			said.className = "song-fingering-heard";
			said.textContent = heard;
			name.appendChild(said);
		}
		if (wrap && (name.firstChild)) wrap.appendChild(name);
	}
	drawSongLine(s.pos);
}

// How far from a note's center a tap still picks it (SVG units)
var SONG_TAP_REACH = 28;

// Stop Hear the song (if playing) and return the staff to the student's note
function stopSongPlayback() {
	// (Play along may be waiting for the mic, not playing yet)
	if (songPlayTimer === null && !songPlayAlong) return;
	clearTimeout(songPlayTimer);
	songPlayTimer = null;
	stopNote();
	stopAccompaniment();
	removeSongFingerings();
	var along = songPlayAlong;
	songPlayAlong = false;
	if (practice && practice.mode === "editor") {
		var editorHear = document.getElementById("editor-hear");
		if (editorHear) editorHear.textContent = "\u25b6 Hear it";
		drawEditor();
		return;
	}
	if (practice && practice.mode === "lesson" && practice.step === -1) {
		var overviewHear = document.getElementById("overview-hear");
		if (overviewHear) overviewHear.textContent = "\u25b6 Hear them";
		drawLessonOverview(-1);
		return;
	}
	if (!practice || !practice.song || practice.mode !== "song") return;
	// Play along stopped partway: that run doesn't count
	var s = practice.song;
	if (along && s.along && !s.along.ended) {
		s.along = null;
		s.results = s.notes.map(function() { return null; });
		songMicOff();
	}
	practice.ignoreUntil = performance.now() + 400;
	resetPracticeHold();
	var hear = document.getElementById("song-hear");
	if (hear) hear.textContent = songHearLabel();
	var alongButton = document.getElementById("song-along");
	if (alongButton) alongButton.textContent = playAlongLabel();
	if (along && s.free && !s.done && !s.along) setPracticeFeedback("Play it all the way through!", "Tap a note to see how to play it");
	drawSongLine(s.pos);
	updateSpeedPicker();
}

// ---------------------------------------------------------------------------
// My songs: the student copies a song from their own music into an editor,
// then plays it like the built-in songs. Notes are stored as written for the
// instrument: { s: diatonic step (octave * 7 + letter, C = 0), a: -1/0/1,
// d: "w" | "h" | "q" | "8", dot } or a rest { r: 1, d, dot }. Measures
// follow from the time signature; there are no ties or pickups (yet).
// ---------------------------------------------------------------------------

var NATURAL_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

// A custom song's events (see songEvents()), measures filled in order
function customSongEvents(song) {
	var cap = measureBeats(song.time);
	var filled = 0, measure = 0, slurred = false;
	return song.notes.map(function(n, k) {
		if (filled >= cap - 1e-6) {
			measure++;
			filled = 0;
		}
		var e = { midi: null, dur: n.d, dots: n.dot ? 1 : 0, measure: measure };
		if (n.t) e.tuplet = 1;
		if (n.tie) e.tie = 1;
		if (k > 0 && song.notes[k - 1].tie && !n.r) e.tied = 1;
		// Slurs: so opens one, sc closes it; a note slurred from the note
		// before it is legato (played without a new attack)
		if (slurred && !n.r && k > 0 && !song.notes[k - 1].r) e.legato = 1;
		if (n.sc) {
			e.slurEnd = 1;
			slurred = false;
		}
		if (n.so) {
			e.slurStart = 1;
			slurred = true;
		}
		if (!n.r) {
			e.letter = n.s % 7;
			e.octave = Math.floor(n.s / 7);
			e.alter = n.a || 0;
			e.midi = 12 * (e.octave + 1) + NATURAL_SEMITONES[e.letter] + e.alter;
		}
		filled += eventBeats(e);
		return e;
	});
}

// The measure the next added note goes in: the last one, or a new one once
// it's full
function songEndMeasure(song, events) {
	if (!events.length) return 0;
	var last = events[events.length - 1].measure;
	var filled = events.reduce(function(t, e) { return e.measure === last ? t + eventBeats(e) : t; }, 0);
	return filled >= measureBeats(song.time) - 1e-6 ? last + 1 : last;
}

// Keeping measures honest: notes fill measures in order, so every measure
// but the last must be exactly full and no note may cross a bar line. Each
// edit is tried on a copy and kept only if it overflows no measure (songs
// from before this rule, which may, can't get worse). Edits before the last
// measure never move a bar line: there, time is only traded with rests.
var EDITOR_LENGTHS = [  // longest first
	{ d: "w", dot: 0 }, { d: "h", dot: 1 }, { d: "h", dot: 0 }, { d: "q", dot: 1 },
	{ d: "q", dot: 0 }, { d: "8", dot: 1 }, { d: "8", dot: 0 }
];

function noteBeats(n) {
	return SONG_BEATS[n.d] * (n.dot ? 1.5 : 1) * (n.t ? 2 / 3 : 1);
}

// Triplets (t: three eighths in the time of two) come in groups of 3 in a
// measure: each note's place in its group (0-2, -1 for no triplet), or
// null if a group is left short. The editor can't make them, only keep them.
function tripletPlaces(notes, time) {
	var cap = measureBeats(time);
	var filled = 0, run = 0, ok = true;
	var places = notes.map(function(n) {
		if (filled >= cap - 1e-6) {
			filled = 0;
			if (run % 3) ok = false;
			run = 0;
		}
		filled += noteBeats(n);
		if (!n.t) {
			if (run % 3) ok = false;
			run = 0;
			return -1;
		}
		return run++ % 3;
	});
	return ok && !(run % 3) ? places : null;
}

// Which notes run past their measure's bar line
function overflowingNotes(notes, time) {
	var cap = measureBeats(time);
	var filled = 0;
	return notes.map(function(n) {
		if (filled >= cap - 1e-6) filled = 0;
		var b = noteBeats(n);
		var over = filled + b > cap + 1e-6;
		filled += b;
		return over;
	});
}

function countTrue(list) {
	return list.filter(Boolean).length;
}

// Whether notes (the song's, edited) are allowed; i: the note just changed
function editorNotesFit(notes, time, i) {
	var after = overflowingNotes(notes, time);
	if (i !== undefined && after[i]) return false;
	var song = practice.editor.song;
	return countTrue(after) <= countTrue(overflowingNotes(song.notes, song.time));
}

// Beats left in the last measure (a whole measure once it's full)
function editorRoomAtEnd() {
	var song = practice.editor.song;
	var cap = measureBeats(song.time);
	var filled = 0;
	song.notes.forEach(function(n) {
		if (filled >= cap - 1e-6) filled = 0;
		filled += noteBeats(n);
	});
	return filled >= cap - 1e-6 ? cap : cap - filled;
}

// Rests adding up to beats (longest first), or null if no rests can
function restsFor(beats) {
	var rests = [];
	EDITOR_LENGTHS.forEach(function(l) {
		while (beats >= noteBeats(l) - 1e-6) {
			rests.push({ r: 1, d: l.d, dot: l.dot });
			beats -= noteBeats(l);
		}
	});
	return beats > 1e-6 ? null : rests;
}

// The length the next note at the end gets: the one chosen, or the longest
// that still fits the measure
function editorNextLength() {
	var ed = practice.editor;
	var room = editorRoomAtEnd();
	var chosen = { d: ed.dur, dot: ed.dots ? 1 : 0 };
	if (noteBeats(chosen) <= room + 1e-6) return chosen;
	for (var k = 0; k < EDITOR_LENGTHS.length; k++) {
		if (noteBeats(EDITOR_LENGTHS[k]) <= room + 1e-6) return EDITOR_LENGTHS[k];
	}
	return EDITOR_LENGTHS[EDITOR_LENGTHS.length - 1];
}

// Note i at a new length, or null if it won't fit. Shortening leaves a rest
// in the time it gave up (so later measures don't shift), except in the
// last measure; lengthening takes the time from rests right after it.
function editorNotesWithLength(i, d, dot) {
	var ed = practice.editor;
	var notes = JSON.parse(JSON.stringify(ed.song.notes));
	var events = customSongEvents(ed.song);
	var measure = events[i].measure;
	var old = noteBeats(notes[i]);
	notes[i].d = d;
	notes[i].dot = dot ? 1 : 0;
	var diff = noteBeats(notes[i]) - old;
	var lastMeasure = events[events.length - 1].measure;
	if (diff < -1e-6 && measure !== lastMeasure) {
		var fill = restsFor(-diff);
		if (!fill) return null;
		Array.prototype.splice.apply(notes, [i + 1, 0].concat(fill));
	} else if (diff > 1e-6) {
		// k walks the song as it was; the rests it uses come out at i + 1
		for (var k = i + 1; diff > 1e-6 && k < events.length && events[k].measure === measure && ed.song.notes[k].r && !ed.song.notes[k].t; k++) {
			var b = noteBeats(ed.song.notes[k]);
			if (b <= diff + 1e-6) {
				notes.splice(i + 1, 1);
				diff -= b;
			} else {
				var rest = restsFor(b - diff);
				if (!rest) return null;
				Array.prototype.splice.apply(notes, [i + 1, 1].concat(rest));
				diff = 0;
			}
		}
		// Only the last measure has room to grow into
		if (diff > 1e-6 && measure !== lastMeasure) return null;
	}
	return editorNotesFit(notes, ed.song.time, i) ? notes : null;
}

// The diatonic step of the staff's top line (F5 treble, A3 bass) and the
// range of steps the editor offers around the staff
function editorTopStep() {
	return getCurrentClef() === "bass" ? 26 : 38;
}
var EDITOR_STEPS_ABOVE = 8;   // four ledger lines above the staff
var EDITOR_STEPS_BELOW = 16;  // four ledger lines below

function clampEditorStep(s) {
	var top = editorTopStep();
	return Math.max(top - EDITOR_STEPS_BELOW, Math.min(top + EDITOR_STEPS_ABOVE, s));
}

// The alteration a note at step s gets in measure, placed before event
// index: an accidental earlier in the measure lasts, otherwise the key's
function editorAlterAt(index, s, measure) {
	var ed = practice.editor;
	for (var i = Math.min(index, ed.events.length) - 1; i >= 0 && ed.events[i].measure === measure; i--) {
		var e = ed.events[i];
		if (e.midi !== null && e.letter === s % 7 && e.octave === Math.floor(s / 7)) return e.alter;
	}
	return keyAlter(ed.song.key || "C", s % 7);
}

var SHARE_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
	'<path d="M12 15V3"/><polyline points="7 8 12 3 17 8"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
var PENCIL_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
	'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';

// Note-length icons for the editor (24 × 24)
var DURATION_ICONS = {
	w: '<ellipse cx="12" cy="13" rx="6.5" ry="4.3" fill="none" stroke="currentColor" stroke-width="2.4"/>',
	h: '<ellipse cx="10" cy="17" rx="4.6" ry="3.4" transform="rotate(-20 10 17)" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M14 16V3" stroke="currentColor" stroke-width="2"/>',
	q: '<ellipse cx="10" cy="17" rx="4.6" ry="3.4" transform="rotate(-20 10 17)" fill="currentColor"/><path d="M14 16V3" stroke="currentColor" stroke-width="2"/>',
	"8": '<ellipse cx="9" cy="17" rx="4.6" ry="3.4" transform="rotate(-20 9 17)" fill="currentColor"/><path d="M13 16V3c0 4 6 5 5 10" fill="none" stroke="currentColor" stroke-width="2"/>'
};
var DURATION_NAMES = { w: "Whole note", h: "Half note", q: "Quarter note", "8": "Eighth note" };

function editorIcon(paths) {
	return '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">' + paths + '</svg>';
}

function chevronIcon(points) {
	return editorIcon('<polyline points="' + points + '" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>');
}

// Open the editor on one of the student's songs, or a new one (id null)
// set: a new song written with only one lesson set's notes, the student's
// first 3 (practice.threeSet) or "first5" (the song keeps the set as
// song.three, and the editor stays on those notes)
function openSongEditor(id, set) {
	stopSongPlayback();
	clearTimeout(practiceAdvanceTimer);
	stopNote();
	var existing = id ? findSong(id) : null;
	var song = existing ? JSON.parse(JSON.stringify(existing)) : {
		id: "my-" + Date.now().toString(36),
		title: "My song " + (practice.customSongs.length + 1),
		time: "4/4", key: "C", notes: []
	};
	if (!existing && set) song.three = set;
	song.custom = true;
	setPracticeMode("editor");
	practice.step = -1;
	practice.editor = { song: song, sel: song.notes.length, dur: "q", dots: 0, deleteArmed: false,
		three: song.three && practice.lessons[song.three] ? spellScale(threeNoteScale(song.three)) : null };
	var last = song.notes[song.notes.length - 1];
	if (last) {
		practice.editor.dur = last.d;
		practice.editor.dots = last.dot ? 1 : 0;
	}
	document.getElementById("practice-view").setAttribute("data-step", "song-editor");

	// Name, time and key signatures above the staff
	var meta = document.createElement("div");
	meta.className = "editor-meta";
	var title = document.createElement("input");
	title.type = "text";
	title.id = "editor-title";
	title.className = "editor-title";
	title.maxLength = 40;
	title.value = song.title;
	title.placeholder = "Song name";
	title.setAttribute("aria-label", "Song name");
	title.oninput = function() {
		song.title = title.value;
		saveEditorSong(false);
	};
	var time = document.createElement("select");
	time.className = "editor-select";
	time.setAttribute("aria-label", "Time signature");
	time.title = "Time signature";
	SONG_TIMES.forEach(function(t) { time.add(new Option(t, t)); });
	time.value = song.time;
	time.onchange = function() {
		var counts = countTrue(overflowingNotes(song.notes, song.time));
		if (countTrue(overflowingNotes(song.notes, time.value)) > counts) {
			showToast("Your notes don\u2019t fit in " + time.value + ". Pick the time signature before adding notes.");
			time.value = song.time;
			return;
		}
		song.time = time.value;
		editorChanged(true);
	};
	var key = document.createElement("select");
	key.className = "editor-select";
	key.setAttribute("aria-label", "Key signature: the flats or sharps at the start of each line");
	key.title = "Key signature";
	SONG_KEYS.forEach(function(k) { key.add(new Option(k.label, k.key)); });
	key.value = song.key;
	key.onchange = function() { changeEditorKey(key.value); };
	meta.appendChild(title);
	meta.appendChild(time);
	// A 3- or 5-note song needs no key signature: its flat (if any) is written in
	if (!practice.editor.three) meta.appendChild(key);
	var share = editorTool(SHARE_SVG, "Share this song with a friend", shareEditorSong);
	share.id = "editor-share";
	share.className += " editor-share";
	meta.appendChild(share);
	var steps = document.getElementById("practice-steps");
	steps.innerHTML = "";
	steps.appendChild(meta);

	var body = document.getElementById("practice-body");
	body.innerHTML =
		'<div class="editor-nav">' +
			'<button class="editor-tool editor-step" id="editor-prev" aria-label="Previous note" title="Previous note">' + chevronIcon("15 18 9 12 15 6") + '</button>' +
			'<div class="challenge-progress editor-lines" id="editor-lines" role="group"></div>' +
			'<button class="editor-tool editor-step" id="editor-next" aria-label="Next note" title="Next note">' + chevronIcon("9 6 15 12 9 18") + '</button>' +
		'</div>' +
		'<div class="editor-tools">' +
			'<div class="editor-group" role="group" aria-label="Note length" id="editor-lengths"></div>' +
			'<div class="editor-group" role="group" aria-label="Change the note" id="editor-pitch"></div>' +
		'</div>';
	var lengths = document.getElementById("editor-lengths");
	["w", "h", "q", "8"].forEach(function(d) {
		var b = editorTool(editorIcon(DURATION_ICONS[d]), DURATION_NAMES[d], function() { setEditorDuration(d); });
		b.setAttribute("data-dur", d);
		lengths.appendChild(b);
	});
	var dot = editorTool(editorIcon('<circle cx="12" cy="12" r="3.4" fill="currentColor"/>'), "Dotted", toggleEditorDot);
	dot.id = "editor-dot";
	lengths.appendChild(dot);
	lengths.appendChild(editorTool(editorIcon('<path d="M9.5 3l5 5.5-4 4.5 4.5 5c-3-1.4-5.6-.2-4.3 3.3-3.2-2.6-2.3-6.4 1.4-5.6L8 11l4-4.2z" fill="currentColor"/>'),
		"Add a rest", insertEditorRest));

	var pitch = document.getElementById("editor-pitch");
	if (practice.editor.three) {
		// One button per note: adds it at the end, or changes the selected note
		practice.editor.three.forEach(function(n, k) {
			var name = songNoteName(n);
			var b = editorTool("", name, function() { setEditorThreeNote(k); });
			b.textContent = name;
			b.className += " editor-note";
			b.setAttribute("data-three", k);
			pitch.appendChild(b);
		});
	} else {
		[[-1, "\u266d", "Flat"], [0, "\u266e", "Natural"], [1, "\u266f", "Sharp"]].forEach(function(acc) {
			var b = editorTool(acc[1], acc[2], function() { setEditorAccidental(acc[0]); });
			b.className += " editor-accidental";
			b.setAttribute("data-alter", acc[0]);
			pitch.appendChild(b);
		});
	}
	var del = editorTool(editorIcon('<path d="M9 5h11v14H9l-6-7z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 9l5 6M17 9l-5 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
		"Delete the note", deleteEditorNote);
	del.id = "editor-delete";
	pitch.appendChild(del);

	// Up and down sit beside the staff, by the notes they move
	var up = editorTool(chevronIcon("6 15 12 9 18 15"), "Move the note up", function() { nudgeEditorNote(1); });
	up.id = "editor-up";
	var down = editorTool(chevronIcon("6 9 12 15 18 9"), "Move the note down", function() { nudgeEditorNote(-1); });
	down.id = "editor-down";
	var arrows = document.createElement("div");
	arrows.className = "editor-staff-arrows";
	arrows.id = "editor-staff-arrows";
	arrows.appendChild(up);
	arrows.appendChild(down);
	document.querySelector("#practice-view .practice-staff").appendChild(arrows);
	document.getElementById("editor-prev").onclick = function() { moveEditorSelection(-1); };
	document.getElementById("editor-next").onclick = function() { moveEditorSelection(1); };
	document.querySelector("#practice-body .editor-nav").appendChild(songViewButton());

	var actions = document.createElement("div");
	actions.className = "practice-actions editor-actions";
	var hear = practiceButton("\u25b6 Hear it", "secondary", function() {
		if (songPlayTimer !== null) {
			stopSongPlayback();
		} else {
			hear.textContent = "\u25a0 Stop";
			playSongEvents(practice.editor.events, function(i) { drawEditor(i); },
				{ piano: songBacking(practice.editor.song, practice.editor.events) });
		}
	});
	hear.id = "editor-hear";
	var remove = practiceButton("Delete", "secondary", deleteEditorSong);
	remove.id = "editor-remove";
	var play = practiceButton("Play it \u2192", "primary", function() { playThroughSong(song.id); });
	play.id = "editor-play";
	actions.appendChild(hear);
	actions.appendChild(remove);
	actions.appendChild(play);
	body.appendChild(actions);

	if (practiceStartedMic && listenActive) stopListening();
	practiceStartedMic = false;
	drawEditor();
}

function editorTool(html, label, onclick) {
	var b = document.createElement("button");
	b.className = "editor-tool";
	b.innerHTML = html;
	b.setAttribute("aria-label", label);
	b.title = label;
	b.onclick = onclick;
	return b;
}

// Store the song as it stands (a song with no notes is removed). Changed
// notes make an earlier best score meaningless, so it's cleared.
function saveEditorSong(notesChanged) {
	var song = practice.editor.song;
	var list = practice.customSongs;
	var i = list.map(function(s) { return s.id; }).indexOf(song.id);
	var stored = JSON.parse(JSON.stringify(song));
	stored.title = song.title.trim() || "My song";
	stored.custom = true;
	if (!song.notes.length) {
		if (i >= 0) list.splice(i, 1);
	} else if (i >= 0) {
		list[i] = stored;
	} else {
		list.push(stored);
	}
	saveCustomSongs(practice.instrument, list);
	checkBadges();
	if (notesChanged && song.id in practice.songBest) {
		delete practice.songBest[song.id];
		saveSongBest(practice.instrument, practice.songBest);
	}
	if (notesChanged && song.id in practice.songSpeedBest) {
		delete practice.songSpeedBest[song.id];
		saveSongSpeedBest(practice.instrument, practice.songSpeedBest);
	}
}

function editorChanged(notesChanged) {
	dropBrokenTies(practice.editor.song.notes);
	dropBrokenSlurs(practice.editor.song.notes);
	stopSongPlayback();
	practice.editor.deleteArmed = false;
	practice.editor.showEnd = false;
	saveEditorSong(notesChanged);
	drawEditor();
}

// Draw the editor's line (the selected note's, or the end's) and bring the
// tools up to date. playing: the event Hear it is on, shown instead.
function drawEditor(playing) {
	var ed = practice.editor;
	var song = ed.song;
	var events = customSongEvents(song);
	ed.events = events;
	var n = events.length;
	ed.sel = Math.max(0, Math.min(ed.sel, n));
	ed.endMeasure = songEndMeasure(song, events);
	ed.measures = ed.endMeasure + 1;
	var isPlaying = typeof playing === "number";
	var focus = isPlaying ? playing : ed.sel;
	// At the end, the line stays on the last note (so it can still be fixed)
	// until a note goes on the next line, unless that line was asked for
	var lastMeasure = n ? events[n - 1].measure : 0;
	var focusMeasure = focus < n ? events[focus].measure
		: n && ed.endMeasure > lastMeasure && !ed.showEnd ? lastMeasure : ed.endMeasure;
	var target = isPlaying ? -1 : editorTargetIndex();
	// A phone gets one measure per line, big enough to tap a line or space
	ed.perLine = window.matchMedia("(max-width: 700px)").matches ? 1 : EDITOR_MEASURES_PER_LINE;
	ed.line = Math.floor(focusMeasure / ed.perLine);
	// That's one measure in view, so the measures before it stack above it
	// (scrolling), and a full measure doesn't vanish from sight
	var through = !songWholeView && ed.perLine === 1;
	ed.stacked = songWholeView || through;
	document.getElementById("practice-view").setAttribute("data-editor-stack", through ? "1" : "0");

	var accent = getComputedStyle(document.body).getPropertyValue("--accent").trim() || "#4f46e5";
	var out = document.getElementById("practice-staff-output");
	ed.layouts = renderSongView(out, song, events, ed.line, ed.measures, { left: true, perLine: ed.perLine, through: through, keySig: true },
		function(i) { return i === focus || i === target ? accent : null; });
	ed.layout = ed.layouts[ed.line];
	// ▲▼ stay beside that measure, at the bottom
	var current = out.querySelector(".song-line.current");
	if (through && current) out.parentNode.style.setProperty("--editor-line-h", current.offsetHeight + "px");

	// A blinking caret where the next note goes (with the lines stacked, on
	// the end's own line when it's showing)
	var r = ed.stacked ? ed.layouts[Math.floor(ed.endMeasure / ed.perLine)] || ed.layout : ed.layout;
	if (!isPlaying && ed.sel === n && r.svg && (r.measureX[ed.endMeasure] || r.xs[n - 1] !== undefined)) {
		var x;
		if (r.measureX[ed.endMeasure]) {
			var area = r.measureX[ed.endMeasure];
			x = area[0] + 10;
			if (n && lastMeasure === ed.endMeasure && r.xs[n - 1] !== undefined) x = r.xs[n - 1] + 22;
			x = Math.min(x, area[1] - 6);
		} else {
			// The next note starts a new line: the caret waits after the last
			x = Math.min(r.xs[n - 1] + 22, r.measureX[lastMeasure][1] + 4);
		}
		var top = r.stave.getYForLine(0) - 10;
		var caret = document.createElementNS("http://www.w3.org/2000/svg", "rect");
		caret.setAttribute("class", "editor-caret");
		caret.setAttribute("x", x - 3);
		caret.setAttribute("y", top);
		caret.setAttribute("width", 6);
		caret.setAttribute("height", r.stave.getYForLine(4) + 10 - top);
		caret.setAttribute("rx", 3);
		caret.setAttribute("fill", accent);
		r.svg.appendChild(caret);
	}

	document.getElementById("practice-prompt").textContent = ed.three
		? (ed.sel < n ? "Pick a note to change it to" : "Tap " + ed.three.map(songNoteName).join(", ").replace(/, ([^,]*)$/, " or $1") + " to add a note")
		: n ? "Tap a note to change it" : "Tap the staff to add a note";

	// One dot per line; tap one to go there
	var lines = Math.ceil(ed.measures / ed.perLine);
	var dots = document.getElementById("editor-lines");
	dots.innerHTML = "";
	dots.setAttribute("aria-label", "Line " + (ed.line + 1) + " of " + lines);
	for (var line = 0; line < lines; line++) {
		(function(line) {
			var dot = document.createElement("button");
			dot.className = "challenge-dot" + (line === ed.line ? " current" : "");
			dot.setAttribute("aria-label", "Line " + (line + 1));
			dot.onclick = function() { goToEditorLine(line); };
			dots.appendChild(dot);
		})(line);
	}

	var selected = target >= 0 ? events[target] : null;
	var isNote = !!selected;
	// Lengths that won't fit the measure are disabled; at the end the next
	// note's length is the longest that fits
	var chosenNote = ed.sel < n ? song.notes[ed.sel] : null;
	var shown = chosenNote ? { d: chosenNote.d, dot: chosenNote.dot ? 1 : 0 } : editorNextLength();
	var room = editorRoomAtEnd();
	var locked = chosenNote && editorLengthLock(ed.sel);
	function lengthFits(d, dot) {
		if (locked) return false;
		return chosenNote ? !!editorNotesWithLength(ed.sel, d, dot) : noteBeats({ d: d, dot: dot }) <= room + 1e-6;
	}
	document.querySelectorAll("#editor-lengths [data-dur]").forEach(function(b) {
		var d = b.getAttribute("data-dur");
		b.setAttribute("aria-pressed", d === shown.d ? "true" : "false");
		b.disabled = !isPlaying && !((d === shown.d && !locked) || lengthFits(d, chosenNote ? shown.dot : 0));
	});
	var dot = document.getElementById("editor-dot");
	dot.setAttribute("aria-pressed", shown.dot ? "true" : "false");
	dot.disabled = !isPlaying && !lengthFits(shown.d, shown.dot ? 0 : 1);
	document.querySelectorAll("#editor-pitch .editor-accidental").forEach(function(b) {
		b.disabled = !isNote;
		b.setAttribute("aria-pressed", isNote && parseInt(b.getAttribute("data-alter"), 10) === selected.alter ? "true" : "false");
	});
	// The 3 note buttons: the selected note's is pressed
	document.querySelectorAll("#editor-pitch .editor-note").forEach(function(b) {
		var n3 = ed.three[parseInt(b.getAttribute("data-three"), 10)];
		var on = !isPlaying && chosenNote && !chosenNote.r && chosenNote.s === n3.s;
		b.setAttribute("aria-pressed", on ? "true" : "false");
	});
	document.getElementById("editor-up").disabled = !isNote;
	document.getElementById("editor-down").disabled = !isNote;
	document.getElementById("editor-delete").disabled = !n;
	document.getElementById("editor-prev").disabled = ed.sel === 0;
	document.getElementById("editor-next").disabled = ed.sel >= n;
	var playable = events.some(function(e) { return e.midi !== null; });
	document.getElementById("editor-hear").disabled = !playable;
	document.getElementById("editor-share").disabled = !playable;
	document.getElementById("editor-play").disabled = !playable;
	var remove = document.getElementById("editor-remove");
	remove.textContent = ed.deleteArmed ? "Tap again to delete" : "Delete";
	remove.classList.toggle("danger", ed.deleteArmed);
}

// The note the pitch buttons change: the selected one, or at the end the
// last one placed (-1 for none, or a rest)
function editorTargetIndex() {
	var ed = practice.editor;
	var notes = ed.song.notes;
	var i = ed.sel < notes.length ? ed.sel : notes.length - 1;
	return i >= 0 && !notes[i].r ? i : -1;
}

// Select an event (n = the end), taking its length for the notes that follow
function selectEditorEvent(i) {
	var ed = practice.editor;
	ed.showEnd = false;
	ed.sel = Math.max(0, Math.min(i, ed.song.notes.length));
	var note = ed.song.notes[ed.sel];
	if (note) {
		ed.dur = note.d;
		ed.dots = note.dot ? 1 : 0;
	}
}

function moveEditorSelection(dir) {
	stopSongPlayback();
	selectEditorEvent(practice.editor.sel + dir);
	drawEditor();
}

function goToEditorLine(line) {
	stopSongPlayback();
	var ed = practice.editor;
	var first = ed.events.map(function(e) { return e.measure; }).findIndex(function(m) {
		return Math.floor(m / ed.perLine) === line;
	});
	selectEditorEvent(first >= 0 ? first : ed.events.length);
	ed.showEnd = first < 0;
	drawEditor();
}

// Sound a note the student just placed or changed
function previewEditorNote(i) {
	var e = practice.editor.events[i];
	if (!e || e.midi === null) return;
	stopNote();
	playTone(frequencyFromNoteNumber(e.midi - getTransposition()), false, null, 0.4);
}

// Add a note (or rest) after the selection, or at the end. At the end the
// editor moves on to the next note; in the middle the new note is selected.
function insertEditorNote(note, atEnd) {
	var ed = practice.editor;
	var n = ed.song.notes.length;
	var pos = atEnd || ed.sel >= n - 1 ? n : ed.sel + 1;
	var notes = ed.song.notes.slice();
	notes.splice(pos, 0, note);
	var places = tripletPlaces(ed.song.notes, ed.song.time);
	if (places && pos < n && places[pos] > 0) {
		showToast("Add it before or after the triplet.");
		return;
	}
	if (pos > 0 && pos < n && ed.song.notes[pos - 1].tie) {
		showToast("Add it before or after the tied notes.");
		return;
	}
	if (!editorInLastMeasure(pos) || !editorNotesFit(notes, ed.song.time, pos)) {
		showToast("That measure is full. Make a note shorter, or add it at the end.");
		return;
	}
	ed.song.notes = notes;
	ed.sel = pos === n ? n + 1 : pos;
	ed.showEnd = false;
	editorChanged(true);
	previewEditorNote(pos);
}

var TRIPLET_TOAST = "Triplets keep their length. Change their notes with \u25b2\u25bc.";

// Why note i's length can't change (a triplet, or tied), or null
function editorLengthLock(i) {
	var notes = practice.editor.song.notes;
	if (notes[i].t) return TRIPLET_TOAST;
	if (notes[i].tie || (i > 0 && notes[i - 1].tie)) return "Tied notes keep their length. Change their notes with \u25b2\u25bc.";
	return null;
}

// Tied notes are one sound: a new pitch for note i goes to the notes tied
// to it too
function editorSyncTie(i) {
	var notes = practice.editor.song.notes;
	var n = notes[i], k;
	for (k = i; k > 0 && notes[k - 1].tie; k--) {
		notes[k - 1].s = n.s;
		notes[k - 1].a = n.a;
	}
	for (k = i; notes[k].tie && notes[k + 1] && !notes[k + 1].r; k++) {
		notes[k + 1].s = n.s;
		notes[k + 1].a = n.a;
	}
}

// A slur that lost a note it started or ended on is dropped (a rest
// can't hold one)
function dropBrokenSlurs(notes) {
	var open = -1;
	notes.forEach(function(n, k) {
		if (n.r) {
			delete n.so;
			delete n.sc;
		}
		if (n.sc) {
			if (open < 0) delete n.sc;
			open = -1;
		}
		if (n.so) {
			if (open >= 0) delete notes[open].so;
			open = k;
		}
	});
	if (open >= 0) delete notes[open].so;
}

// A tie whose next note is gone, a rest or another pitch is dropped
function dropBrokenTies(notes) {
	notes.forEach(function(n, k) {
		var next = notes[k + 1];
		if (n.tie && (n.r || !next || next.r || next.s !== n.s || next.a !== n.a)) delete n.tie;
	});
}

// A note or rest rebuilt from old keeps old's triplet, tie and slur marks
function keepMarks(old, note) {
	["t", "tie", "so", "sc"].forEach(function(k) {
		if (old[k]) note[k] = 1;
	});
	return note;
}

// A new note for step s going in at pos, with the flat or sharp the key
// (or an accidental earlier in its measure) gives it there
function newEditorNote(s, pos) {
	var ed = practice.editor;
	if (ed.three) {
		var n3 = editorThreeNear(s);
		var len = editorInsertLength(pos);
		return { s: n3.s, a: n3.alter, d: len.d, dot: len.dot };
	}
	s = clampEditorStep(s);
	var measure = pos >= ed.events.length ? ed.endMeasure : pos > 0 ? ed.events[pos - 1].measure : 0;
	var length = editorInsertLength(pos);
	return { s: s, a: editorAlterAt(pos, s, measure), d: length.d, dot: length.dot };
}

// Whether everything from note pos on is in the last measure, so adding or
// removing a note there moves no bar line
function editorInLastMeasure(pos) {
	var events = customSongEvents(practice.editor.song);
	return pos >= events.length || events[pos].measure === events[events.length - 1].measure;
}

// At the end a new note takes the longest length that fits the measure
function editorInsertLength(pos) {
	var ed = practice.editor;
	return pos >= ed.song.notes.length ? editorNextLength() : { d: ed.dur, dot: ed.dots ? 1 : 0 };
}

// In a 3-note song: the one of the 3 notes nearest step s
function editorThreeNear(s) {
	return practice.editor.three.reduce(function(best, n) {
		return Math.abs(n.s - s) < Math.abs(best.s - s) ? n : best;
	});
}

// In a 3-note song, a note button: changes the selected note (or rest) to
// that note, or at the end adds it
function setEditorThreeNote(k) {
	var ed = practice.editor;
	var n3 = ed.three[k];
	var n = ed.song.notes.length;
	if (ed.sel < n) {
		var note = ed.song.notes[ed.sel];
		ed.song.notes[ed.sel] = keepMarks(note, { s: n3.s, a: n3.alter, d: note.d, dot: note.dot ? 1 : 0 });
		editorSyncTie(ed.sel);
		editorChanged(true);
		previewEditorNote(ed.sel);
	} else {
		insertEditorNote(newEditorNote(n3.s, n), true);
	}
}

function insertEditorRest() {
	var ed = practice.editor;
	var n = ed.song.notes.length;
	var length = editorInsertLength(ed.sel >= n - 1 ? n : ed.sel + 1);
	insertEditorNote({ r: 1, d: length.d, dot: length.dot });
}

// Type a letter (desktop): the nearest such note to the one before
function insertEditorLetter(letter) {
	var ed = practice.editor;
	if (ed.three) {
		var k = ed.three.map(function(n) { return n.letter; }).indexOf(letter);
		if (k >= 0) setEditorThreeNote(k);
		return;
	}
	var n = ed.song.notes.length;
	var pos = ed.sel >= n ? n : ed.sel + 1;
	var near = editorTopStep() - 4;  // the middle line
	for (var i = pos - 1; i >= 0; i--) {
		if (!ed.song.notes[i].r) {
			near = ed.song.notes[i].s;
			break;
		}
	}
	var s = letter + 7 * Math.round((near - letter) / 7);
	insertEditorNote(newEditorNote(s, pos));
}

// A new length for the selected note (if it fits) or for the next note
function setEditorLength(d, dot) {
	var ed = practice.editor;
	if (ed.sel < ed.song.notes.length && editorLengthLock(ed.sel)) {
		showToast(editorLengthLock(ed.sel));
		return;
	}
	if (ed.sel < ed.song.notes.length) {
		var notes = editorNotesWithLength(ed.sel, d, dot);
		if (!notes) {
			showToast("That\u2019s too long for this measure.");
			return;
		}
		ed.song.notes = notes;
		ed.dur = d;
		ed.dots = dot ? 1 : 0;
		editorChanged(true);
	} else {
		ed.dur = d;
		ed.dots = dot ? 1 : 0;
		drawEditor();
	}
}

function setEditorDuration(d) {
	var ed = practice.editor;
	var note = ed.song.notes[ed.sel];
	setEditorLength(d, note ? note.dot : ed.dots);
}

function toggleEditorDot() {
	var ed = practice.editor;
	var note = ed.song.notes[ed.sel];
	if (note) setEditorLength(note.d, !note.dot);
	else setEditorLength(editorNextLength().d, !editorNextLength().dot);
}

function setEditorAccidental(alter) {
	var ed = practice.editor;
	var i = editorTargetIndex();
	if (i < 0) return;
	ed.song.notes[i].a = alter;
	editorSyncTie(i);
	editorChanged(true);
	previewEditorNote(i);
}

// Up or down a line or space; the note takes the key's (or the measure's)
// flat or sharp there
function nudgeEditorNote(dir) {
	var ed = practice.editor;
	var i = editorTargetIndex();
	if (i < 0) return;
	var note = ed.song.notes[i];
	if (ed.three) {
		// To the next of the 3 notes
		var k = ed.three.indexOf(editorThreeNear(note.s));
		var to = ed.three[Math.max(0, Math.min(ed.three.length - 1, k + dir))];
		if (to.s === note.s && to.alter === (note.a || 0)) return;
		note.s = to.s;
		note.a = to.alter;
		editorSyncTie(i);
		editorChanged(true);
		previewEditorNote(i);
		return;
	}
	note.s = clampEditorStep(note.s + dir);
	note.a = editorAlterAt(i, note.s, ed.events[i].measure);
	editorSyncTie(i);
	editorChanged(true);
	previewEditorNote(i);
}

// Delete the selected note, or the last one from the end. A triplet's
// notes become rests, so the group keeps its time, and from the end the
// whole group goes.
function deleteEditorNote() {
	var ed = practice.editor;
	var n = ed.song.notes.length;
	if (!n) return;
	var at = ed.sel >= n ? n - 1 : ed.sel;
	var picked = ed.song.notes[at];
	if (at > 0 && !picked.r) delete ed.song.notes[at - 1].tie;
	if (picked.t && ed.sel >= n) {
		var places = tripletPlaces(ed.song.notes, ed.song.time);
		ed.song.notes.splice(n - 1 - (places ? places[n - 1] : 0));
		ed.sel = ed.song.notes.length;
	} else if (picked.t) {
		if (picked.r) {
			showToast(TRIPLET_TOAST);
			return;
		}
		ed.song.notes[at] = { r: 1, d: picked.d, dot: 0, t: 1 };
	} else if (ed.sel >= n) {
		ed.song.notes.pop();
		ed.sel = n - 1;
	} else {
		var notes = ed.song.notes.slice();
		notes.splice(ed.sel, 1);
		if (editorInLastMeasure(ed.sel)) {
			ed.song.notes = notes;
			selectEditorEvent(ed.sel > 0 ? ed.sel - 1 : 0);
		} else if (!ed.song.notes[ed.sel].r) {
			// Taking it out would pull later notes across bar lines: a rest
			// keeps its time (tap the rest to make it a note again)
			var note = ed.song.notes[ed.sel];
			ed.song.notes[ed.sel] = { r: 1, d: note.d, dot: note.dot ? 1 : 0 };
		} else {
			showToast("This rest keeps the measure full. Tap it to make it a note.");
			return;
		}
	}
	editorChanged(true);
}

// A new key signature changes the notes that followed the old one (as if
// the page had the new key all along); written-in accidentals stay
function changeEditorKey(key) {
	var song = practice.editor.song;
	var old = song.key || "C";
	song.notes.forEach(function(n) {
		if (!n.r && (n.a || 0) === keyAlter(old, n.s % 7)) n.a = keyAlter(key, n.s % 7);
	});
	song.key = key;
	editorChanged(true);
}

// Delete the whole song: the first tap asks, the second deletes
function deleteEditorSong() {
	var ed = practice.editor;
	if (!ed.deleteArmed && ed.song.notes.length) {
		ed.deleteArmed = true;
		drawEditor();
		clearTimeout(practiceAdvanceTimer);
		practiceAdvanceTimer = setTimeout(function() {
			if (practice.mode !== "editor" || !practice.editor.deleteArmed) return;
			practice.editor.deleteArmed = false;
			drawEditor();
		}, 3000);
		return;
	}
	ed.song.notes = [];
	saveEditorSong(true);
	showSongList();
}

// Tap the staff: past the last note adds one there; on a note selects it,
// and on the selected note (or, at the end, the last one placed) moves it
// to the line or space tapped
function editorStaffTap(event) {
	if (!practiceOpen || !practice || practice.mode !== "editor") return;
	var ed = practice.editor;
	if (songPlayTimer !== null) {
		stopSongPlayback();
		return;
	}
	// With the lines stacked, the line tapped
	var r = ed.layout;
	if (ed.stacked) {
		var lineEl = event.target.closest ? event.target.closest(".song-line") : null;
		r = lineEl ? ed.layouts[lineEl.getAttribute("data-line")] : null;
	}
	if (!r || !r.svg || !r.stave) return;
	var pt = r.svg.createSVGPoint();
	pt.x = event.clientX;
	pt.y = event.clientY;
	var p = pt.matrixTransform(r.svg.getScreenCTM().inverse());
	var s = clampEditorStep(editorTopStep() - Math.round((p.y - r.stave.getYForLine(0)) / (LINE_SPACING / 2)));
	var three = ed.three ? editorThreeNear(s) : null;
	if (three) s = three.s;

	var nearest = -1, nearestDist = Infinity, lastOnLine = -1;
	Object.keys(r.xs).forEach(function(k) {
		var i = parseInt(k, 10);
		var d = Math.abs(r.xs[i] - p.x);
		if (d < nearestDist) {
			nearest = i;
			nearestDist = d;
		}
		lastOnLine = Math.max(lastOnLine, i);
	});
	// Past the song's last note adds a note, even when it starts the next line
	var n = ed.events.length;
	if (lastOnLine < 0 || (lastOnLine === n - 1 && p.x > r.xs[lastOnLine] + 14)) {
		insertEditorNote(newEditorNote(s, n), true);
	} else if (nearest >= 0) {
		var note = ed.song.notes[nearest];
		if (nearest === ed.sel && nearestDist < 16 && note.r) {
			// The selected rest becomes a note where it was tapped
			ed.song.notes[nearest] = keepMarks(note, { s: s, a: three ? three.alter : editorAlterAt(nearest, s, ed.events[nearest].measure), d: note.d, dot: note.dot ? 1 : 0 });
			editorChanged(true);
		} else if (nearest === editorTargetIndex() && nearestDist < 16 && note.s !== s) {
			note.s = s;
			note.a = three ? three.alter : editorAlterAt(nearest, s, ed.events[nearest].measure);
			editorSyncTie(nearest);
			editorChanged(true);
		} else {
			selectEditorEvent(nearest);
			drawEditor();
		}
		previewEditorNote(nearest);
	}
}

// Keys in the editor (desktop): letters add notes, arrows move and change
// them, 1 2 4 8 pick a length, . dots it, R adds a rest
function editorKeyDown(event) {
	var target = event.target;
	if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) return;
	if (event.altKey || event.ctrlKey || event.metaKey) return;
	var key = event.key;
	var letter = "cdefgab".indexOf(key.toLowerCase());
	if (key.length === 1 && letter >= 0) insertEditorLetter(letter);
	else if (key === "r" || key === "R") insertEditorRest();
	else if (key === "ArrowLeft") moveEditorSelection(-1);
	else if (key === "ArrowRight") moveEditorSelection(1);
	else if (key === "ArrowUp") nudgeEditorNote(1);
	else if (key === "ArrowDown") nudgeEditorNote(-1);
	else if (key === "Backspace" || key === "Delete") deleteEditorNote();
	else if (key === "1") setEditorDuration("w");
	else if (key === "2") setEditorDuration("h");
	else if (key === "4") setEditorDuration("q");
	else if (key === "8") setEditorDuration("8");
	else if (key === ".") toggleEditorDot();
	else return;
	event.preventDefault();
}

document.getElementById("practice-staff-output").addEventListener("click", editorStaffTap);
document.getElementById("practice-staff-output").addEventListener("click", songPickerTap);
document.getElementById("practice-staff-output").addEventListener("click", songNoteTap);

// ---------------------------------------------------------------------------
// Sharing songs: the whole song rides in a link (#song=…), so there's no
// server. The payload is base64url JSON: { v: 1, t: title, i: instrument,
// k: key, m: time, n: notes }, notes a string of tokens: length (w h q e),
// an optional "." for a dot, an optional "t" for a triplet eighth (in
// groups of 3: "etF3 etG3 etF3"), then "r" for a rest or the written note
// ("Bb4", "C5"), a note ending in "~" if it's tied to the next ("hF4~ qF4").
// A slur opens with "(" before a note's token and closes with ")" after
// one: "(qF4 eG4 eA4)". A friend on another instrument gets it rewritten for
// theirs (transposeSharedSong()), sounding the same.
// ---------------------------------------------------------------------------

var SHARE_MAX_NOTES = 400;
var pendingSongImport = null;  // a shared song waiting for Practice to open

function encodeSongShare(song, instrument) {
	var notes = song.notes.map(function(n) {
		var token = (n.so ? "(" : "") + (n.d === "8" ? "e" : n.d) + (n.dot ? "." : "") + (n.t ? "t" : "");
		if (n.r) return token + "r";
		return token + "CDEFGAB".charAt(n.s % 7) + (n.a < 0 ? "b" : n.a > 0 ? "#" : "") + Math.floor(n.s / 7) + (n.tie ? "~" : "") + (n.sc ? ")" : "");
	}).join(" ");
	var json = JSON.stringify({ v: 1, t: song.title.trim() || "My song", i: instrument, k: song.key || "C", m: song.time || "4/4", n: notes });
	var bytes = new TextEncoder().encode(json);
	var binary = "";
	bytes.forEach(function(b) { binary += String.fromCharCode(b); });
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// A shared song from a link's payload, or null if it doesn't check out:
// { title, instrument, song: { time, key, notes } }
function decodeSongShare(payload) {
	try {
		var binary = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
		var bytes = new Uint8Array(binary.length);
		for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
		var data = JSON.parse(new TextDecoder().decode(bytes));
		if (!data || typeof data.t !== "string" || typeof data.n !== "string") return null;
		if (!(data.i in practiceStartConcertMidi) || !(data.k in keySignatureNotes) || SONG_TIMES.indexOf(data.m) < 0) return null;
		var tokens = data.n.split(" ");
		if (!tokens.length || tokens.length > SHARE_MAX_NOTES) return null;
		var notes = [];
		for (var j = 0; j < tokens.length; j++) {
			var m = /^(\(?)([whqe])(\.?)(t?)(?:(r)|([A-G])([b#]?)([0-8])(~?)(\)?))$/.exec(tokens[j]);
			if (!m) return null;
			var note = { d: m[2] === "e" ? "8" : m[2], dot: m[3] ? 1 : 0 };
			if (m[4]) {
				// Only plain eighths come in triplets
				if (note.d !== "8" || note.dot) return null;
				note.t = 1;
			}
			if (m[5]) {
				if (m[1]) return null;  // a slur starts on a note
				note.r = 1;
			} else {
				note.s = parseInt(m[8], 10) * 7 + "CDEFGAB".indexOf(m[6]);
				note.a = m[7] === "b" ? -1 : m[7] === "#" ? 1 : 0;
				if (m[9]) note.tie = 1;
				if (m[1]) note.so = 1;
				if (m[10]) note.sc = 1;
			}
			notes.push(note);
		}
		// A tie holds a note on into the same note
		var tieOk = notes.every(function(n, k) {
			var next = notes[k + 1];
			return !n.tie || (next && !next.r && next.s === n.s && next.a === n.a);
		});
		if (!tieOk) return null;
		// Every slur closed on a later note, none inside another
		var open = -1;
		var slursOk = notes.every(function(n, k) {
			if (n.sc) {
				if (open < 0) return false;
				open = -1;
			}
			if (n.so) {
				if (open >= 0) return false;
				open = k;
			}
			return true;
		}) && open < 0;
		if (!slursOk) return null;
		if (!notes.some(function(n) { return !n.r; })) return null;
		if (!tripletPlaces(notes, data.m)) return null;
		return {
			title: data.t.trim().slice(0, 40) || "Shared song",
			instrument: data.i,
			song: { time: data.m, key: data.k, notes: notes }
		};
	} catch (e) {
		return null;
	}
}

// Written MIDI note of an instrument's first band note (concert B♭)
function writtenStartMidi(instrument) {
	var start = practiceStartConcertMidi[instrument];
	return (start === undefined ? 70 : start) + (transpositionMap[instrument] || 0);
}

// Rewrite a song written for one instrument for another: the same tune in
// that instrument's octave (their first notes line up), its key moved
// round the circle of fifths and every note respelled to match
function transposeSharedSong(song, from, to) {
	var copy = JSON.parse(JSON.stringify(song));
	var d = writtenStartMidi(to) - writtenStartMidi(from);
	if (!d) return copy;
	// The interval in fifths (7 semitones is its own inverse mod 12)
	var f = (7 * (((d % 12) + 12) % 12)) % 12;
	if (f > 6) f -= 12;
	var keyFifths = (keyToFifths[song.key] || 0) + f;
	if (keyFifths > 6) {
		keyFifths -= 12;
		f -= 12;
	} else if (keyFifths < -6) {
		keyFifths += 12;
		f += 12;
	}
	var steps = ((4 * f) % 7 + 7) % 7;  // a fifth is four letters up
	var shift = steps + 7 * Math.round((d * 7 / 12 - steps) / 7);
	copy.key = fifthsToKey[String(keyFifths)];
	copy.notes.forEach(function(n) {
		if (n.r) return;
		var target = 12 * (Math.floor(n.s / 7) + 1) + NATURAL_SEMITONES[n.s % 7] + (n.a || 0) + d;
		var s = n.s + shift;
		var natural = function(s) { return 12 * (Math.floor(s / 7) + 1) + NATURAL_SEMITONES[s % 7]; };
		// No double flats or sharps: respell on the next letter
		if (target - natural(s) > 1) s++;
		else if (target - natural(s) < -1) s--;
		n.s = s;
		n.a = target - natural(s);
	});
	return copy;
}

// Share the song in the editor: the phone's share sheet, or copy the link
function shareEditorSong() {
	var song = practice.editor.song;
	if (!song.notes.some(function(n) { return !n.r; })) return;
	saveEditorSong(false);
	var url = location.origin + location.pathname + "#song=" + encodeSongShare(song, practice.instrument);
	var title = song.title.trim() || "My song";
	if (navigator.share) {
		navigator.share({ title: title, text: "Play my song \u201c" + title + "\u201d!", url: url }).catch(function(e) {
			if (e && e.name !== "AbortError") copySongLink(url);
		});
	} else {
		copySongLink(url);
	}
}

function copySongLink(url) {
	if (!navigator.clipboard) {
		showToast("Couldn\u2019t copy the link on this browser.");
		return;
	}
	navigator.clipboard.writeText(url).then(function() {
		showToast("Link copied! Send it to a friend.");
	}, function() {
		showToast("Couldn\u2019t copy the link. Try again.");
	});
}

function instrumentLabel(instrument) {
	if (instrument === "euphonium" && kidMode) return "baritone";
	return instrument;
}

// A shared song goes straight into My songs (rewritten for this instrument
// if the friend plays another; an identical copy isn't added twice) and
// opens in Play it through, every practice tool ready. Opened through the
// menu and song list, so back (and the phone's back gesture) steps out the
// usual way.
function openSongImport() {
	if (!practiceOpen) {
		openPractice();  // which comes back here
		return;
	}
	syncPracticeHistory();
	showPracticeMenu("songs");
	syncPracticeHistory();
	showSongList();
	syncPracticeHistory();
	addSharedSong();
}

function addSharedSong() {
	var shared = pendingSongImport;
	pendingSongImport = null;
	if (!shared) return;
	var song = transposeSharedSong(shared.song, shared.instrument, practice.instrument);
	song.custom = true;
	song.title = shared.title;
	var same = practice.customSongs.filter(function(s) {
		return s.title === song.title && JSON.stringify(s.notes) === JSON.stringify(song.notes);
	})[0];
	if (!same) {
		song.id = "my-" + Date.now().toString(36);
		practice.customSongs.push(song);
		saveCustomSongs(practice.instrument, practice.customSongs);
	}
	playThroughSong(same ? same.id : song.id);
	showInfoToast("\u201c" + song.title + "\u201d is in My songs" + (shared.instrument !== practice.instrument
		? ", changed for your " + instrumentLabel(practice.instrument) + "." : "!"));
}

// A song link: take the song out of the address (so a reload doesn't bring
// it back) and show it. With no instrument chosen yet, take the sharer's
// (sign-in still asks a new student theirs).
function checkSongLink() {
	var m = /^#song=([A-Za-z0-9_-]+)$/.exec(location.hash);
	if (!m) return;
	history.replaceState(history.state, "", location.pathname + location.search);
	var shared = decodeSongShare(m[1]);
	if (!shared) {
		showToast("That song link didn\u2019t work. Ask your friend to share it again.");
		return;
	}
	// (The student's own instrument, asked for at sign-in if need be, not
	// the sharer's: it would show in the header as if it were theirs)
	pendingSongImport = shared;
	openSongImport();
}

document.addEventListener("DOMContentLoaded", function() { setTimeout(checkSongLink, 0); });
window.addEventListener("hashchange", checkSongLink);

// ---------------------------------------------------------------------------
// First sounds: the flute head joint, the clarinet mouthpiece and barrel,
// the alto sax mouthpiece and neck, the oboe reed, the brass mouthpiece
// ---------------------------------------------------------------------------

function loadFirstSoundsBest(instrument) {
	try {
		var best = JSON.parse(progressGet(FIRST_SOUNDS_STORAGE_KEY) || "{}")[instrument];
		if (typeof best === "number") return best;
	} catch (e) {}
	return 0;
}

function saveFirstSoundsBest(instrument, stars) {
	try {
		var all = JSON.parse(progressGet(FIRST_SOUNDS_STORAGE_KEY) || "{}");
		all[instrument] = stars;
		progressSet(FIRST_SOUNDS_STORAGE_KEY, JSON.stringify(all));
	} catch (e) {}
}

// The dashed air stream: a curve flowing into a solid arrowhead whose tip is
// at (x, y), pointing down ("down") or right ("right"), drawn over the
// instrument so nothing hides it
function airArrowSVG(x, y, dir) {
	var down = dir === "down";
	// start, control and the arrowhead's base (the curve ends along the head)
	var path = down ?
		[x - 24, y - 34, x - 1, y - 32, x, y - 11] :
		[x - 32, y - 16, x - 22, y, x - 11, y];
	var head = down ?
		[x - 6, y - 12, x + 6, y - 12] :
		[x - 12, y - 6, x - 12, y + 6];
	return '<path d="M' + path[0] + ' ' + path[1] + ' Q' + path[2] + ' ' + path[3] + ' ' + path[4] + ' ' + path[5] +
		'" fill="none" stroke="#4d96ff" stroke-width="3" stroke-linecap="round" stroke-dasharray="5 5"/>' +
		'<path d="M' + x + ' ' + y + ' L' + head[0] + ' ' + head[1] + ' L' + head[2] + ' ' + head[3] +
		' Z" fill="#4d96ff" stroke="#4d96ff" stroke-width="2" stroke-linejoin="round"/>';
}

// Drawings for each setup (drawing ids are used by FIRST_SOUNDS)
function firstSoundsSVG(drawing) {
	var label = {
		"flute-open": "Head joint with the end open",
		"flute-covered": "Head joint with the end covered by your palm",
		"clarinet-barrel": "Clarinet mouthpiece and barrel",
		"sax-neck": "Saxophone mouthpiece on the neck",
		"mouthpiece-small": "Brass mouthpiece",
		"mouthpiece-large": "Large brass mouthpiece",
		"oboe-reed": "Oboe reed"
	}[drawing];
	var s = '<svg class="first-sounds-drawing" viewBox="0 0 250 84" role="img" aria-label="' + label + '">';

	if (drawing === "flute-open" || drawing === "flute-covered") {
		s += '<rect x="6" y="38" width="14" height="20" rx="4" fill="#aeb8c4" stroke="#6b7685" stroke-width="2"/>' +
			'<rect x="18" y="40" width="208" height="16" rx="3" fill="#dfe5ec" stroke="#6b7685" stroke-width="2"/>' +
			'<ellipse cx="50" cy="40" rx="20" ry="8" fill="#cfd7e0" stroke="#6b7685" stroke-width="2"/>' +
			'<ellipse cx="50" cy="40" rx="7" ry="3.5" fill="#2b2140"/>';
		if (drawing === "flute-covered") {
			s += '<ellipse cx="230" cy="48" rx="17" ry="25" fill="#f4c99f" stroke="#b9805a" stroke-width="2"/>' +
				'<ellipse cx="214" cy="30" rx="6" ry="10" transform="rotate(-30 214 30)" fill="#f4c99f" stroke="#b9805a" stroke-width="2"/>';
		} else {
			s += '<ellipse cx="226" cy="48" rx="4" ry="8" fill="#2b2140"/>';
		}
		s += airArrowSVG(50, 36, "down");
	} else if (drawing === "clarinet-barrel") {
		var x0 = 48;
		s += // reed under the beak, mouthpiece body, ligature, then the barrel
			// right against it (the tenon hides inside the barrel)
			'<path d="M' + (x0 + 4) + ' 58 L' + (x0 + 70) + ' 58 L' + (x0 + 70) + ' 62 L' + (x0 + 8) + ' 62 Z" fill="#e8c77a" stroke="#a8843a" stroke-width="1.5"/>' +
			'<path d="M' + x0 + ' 52 Q' + (x0 + 8) + ' 34 ' + (x0 + 34) + ' 32 L' + (x0 + 90) + ' 32 L' + (x0 + 90) + ' 60 L' + (x0 + 2) + ' 58 Z" fill="#2f2f38" stroke="#15151b" stroke-width="2"/>' +
			'<rect x="' + (x0 + 48) + '" y="29" width="14" height="34" rx="3" fill="#c7cfd8" stroke="#6b7685" stroke-width="2"/>' +
			'<path d="M' + (x0 + 90) + ' 32 Q' + (x0 + 134) + ' 26 ' + (x0 + 178) + ' 32 L' + (x0 + 178) + ' 60 Q' + (x0 + 134) + ' 66 ' + (x0 + 90) + ' 60 Z" fill="#2f2f38" stroke="#15151b" stroke-width="2"/>' +
				'<rect x="' + (x0 + 90) + '" y="30" width="6" height="32" rx="2" fill="#c7cfd8" stroke="#6b7685" stroke-width="1.5"/>' +
				'<rect x="' + (x0 + 172) + '" y="30" width="6" height="32" rx="2" fill="#c7cfd8" stroke="#6b7685" stroke-width="1.5"/>' +
			airArrowSVG(x0 - 3, 56, "right");
	} else if (drawing === "mouthpiece-small" || drawing === "mouthpiece-large") {
		// rim and cup on the left (where the lips go), then the stem narrowing
		// to a waist, swelling over the backbore and tapering to the shank tip.
		// About 3 rim widths long (trumpet), a little stubbier for low brass
		var big = drawing === "mouthpiece-large";
		var r = big ? 30 : 22, len = big ? 160 : 150, c0 = Math.round((250 - len) / 2) + 6;
		var cupEnd = c0 + (big ? 44 : 36), end = c0 + len, mid = cupEnd + Math.round((end - cupEnd) * 0.45);
		var t = big ? 8 : 6, sh = big ? 12 : 9, tip = big ? 9 : 6.5;
		s += '<path d="M' + c0 + ' ' + (42 - r) + ' Q' + (cupEnd - 6) + ' ' + (42 - r) + ' ' + cupEnd + ' ' + (42 - t) +
				' C' + (cupEnd + 16) + ' ' + (42 - t) + ' ' + (mid - 24) + ' ' + (42 - sh) + ' ' + mid + ' ' + (42 - sh) +
				' Q' + (mid + 24) + ' ' + (42 - sh) + ' ' + end + ' ' + (42 - tip) +
				' L' + end + ' ' + (42 + tip) + ' Q' + (mid + 24) + ' ' + (42 + sh) + ' ' + mid + ' ' + (42 + sh) +
				' C' + (mid - 24) + ' ' + (42 + sh) + ' ' + (cupEnd + 16) + ' ' + (42 + t) + ' ' + cupEnd + ' ' + (42 + t) +
				' Q' + (cupEnd - 6) + ' ' + (42 + r) + ' ' + c0 + ' ' + (42 + r) + ' Z" fill="#e9c46a" stroke="#a37b1e" stroke-width="2" stroke-linejoin="round"/>' +
			'<rect x="' + (c0 - 6) + '" y="' + (42 - r - 3) + '" width="10" height="' + (2 * r + 6) + '" rx="5" fill="#f1d58a" stroke="#a37b1e" stroke-width="2"/>' +
			airArrowSVG(c0 - 9, 42, "right");
	} else if (drawing === "oboe-reed") {
		// two cane blades meeting at a thin tip, thread wrapping, cork and staple
		s += '<g transform="translate(12 0)">' +
			'<path d="M30 38 Q60 30 120 33 L120 51 Q60 54 30 46 Z" fill="#e8c77a" stroke="#a8843a" stroke-width="2"/>' +
			'<path d="M30 42 L120 42" stroke="#a8843a" stroke-width="1.5"/>' +
			'<rect x="120" y="32" width="44" height="20" rx="3" fill="#d84a4a" stroke="#8f2626" stroke-width="2"/>' +
			'<path d="M164 34 L226 37 L226 47 L164 50 Z" fill="#c9a27a" stroke="#86643f" stroke-width="2"/>' +
			'</g>' + airArrowSVG(39, 42, "right");
	} else {
		var m0 = 36;
		s += 			'<path d="M' + (m0 + 4) + ' 55 L' + (m0 + 64) + ' 55 L' + (m0 + 64) + ' 59 L' + (m0 + 8) + ' 59 Z" fill="#e8c77a" stroke="#a8843a" stroke-width="1.5"/>' +
			'<path d="M' + m0 + ' 50 Q' + (m0 + 12) + ' 34 ' + (m0 + 40) + ' 33 L' + (m0 + 100) + ' 38 L' + (m0 + 100) + ' 54 L' + (m0 + 2) + ' 55 Z" fill="#2f2f38" stroke="#15151b" stroke-width="2"/>' +
			'<rect x="' + (m0 + 40) + '" y="31" width="16" height="30" rx="3" fill="#c7cfd8" stroke="#6b7685" stroke-width="2"/>' +
			// the brass neck, curving down and widening toward the body joint
			'<path d="M' + (m0 + 92) + ' 40 Q' + (m0 + 158) + ' 34 ' + (m0 + 191) + ' 56 L' + (m0 + 205) + ' 80 L' + (m0 + 184) + ' 82 L' + (m0 + 175) + ' 64 Q' + (m0 + 150) + ' 50 ' + (m0 + 92) + ' 54 Z" fill="#e9c46a" stroke="#a37b1e" stroke-width="2"/>' +
				'<circle cx="' + (m0 + 142) + '" cy="40" r="4" fill="#d4a93a" stroke="#a37b1e" stroke-width="1.5"/>' +
			airArrowSVG(m0 - 3, 53, "right");
	}
	return s + '</svg>';
}

var FLUTE_ICON_SVG = '<svg width="34" height="20" viewBox="0 0 34 20" aria-hidden="true">' +
	'<rect x="1" y="7" width="32" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>' +
	'<ellipse cx="9" cy="7" rx="5" ry="2.5" fill="currentColor"/></svg>';
var MOUTHPIECE_ICON_SVG = '<svg width="34" height="20" viewBox="0 0 34 20" aria-hidden="true">' +
	'<path d="M2 13 Q5 5 12 5 L31 6 L31 15 L3 15 Z" fill="currentColor"/>' +
	'<rect x="13" y="3" width="5" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

var BRASS_ICON_SVG = '<svg width="34" height="20" viewBox="0 0 34 20" aria-hidden="true">' +
	'<path d="M3 3 Q11 3 12 8 L22 8 L32 7 L32 13 L22 12 L12 12 Q11 17 3 17 Z" fill="currentColor"/></svg>';
var REED_ICON_SVG = '<svg width="34" height="20" viewBox="0 0 34 20" aria-hidden="true">' +
	'<path d="M2 8 Q8 6 15 6 L15 14 Q8 14 2 12 Z" fill="currentColor"/>' +
	'<rect x="15" y="5" width="6" height="10" rx="1" fill="currentColor"/>' +
	'<path d="M21 7 L32 8 L32 12 L21 13 Z" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

// Confidence a pitch frame needs for practice to use it (called by the mic
// loop): looser for first sounds, the main display's 0.85 otherwise
function practiceConfidenceGate() {
	return practice && practice.mode === "firstsounds" ? FIRST_SOUNDS_MIN_CONFIDENCE : 0.85;
}

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
	fs.shownMidi = null;
	if (withExample && !sound.noExample) {
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
			setPracticeFeedback(onFinal && cfg.final === "long" ? "Steady\u2026 keep it going!" : cfg.goodText || "That\u2019s it! Keep blowing\u2026", "\u00a0", "good");
			// A wide band (a buzz, a crow): the staff shows the note being played
			if (sound.follow && Math.round(m) !== fs.shownMidi) {
				fs.shownMidi = Math.round(m);
				drawPracticeStaff(fs.shownMidi + getTransposition(), sound.sharp);
			}
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
				} else if (cfg.squeakHint && cents > sound.high && (sound.squeakMidi ? Math.abs(m - sound.squeakMidi) <= 1 : cents >= 300)) {
					setPracticeFeedback("That\u2019s a squeak", cfg.squeakHint, "close");
				} else if (cents < sound.low) {
					setPracticeFeedback(cfg.lowTitle || "A little low", cfg.lowHint, "close");
				} else {
					setPracticeFeedback(cfg.highTitle || "A little high", cfg.highHint, "close");
				}
			}
		}
	} else if (now - practice.lastSound > 1500) {
		setPracticeFeedback(sound.idle, !fs.heard && now - fs.started > 6000 ? cfg.noSoundHint : "\u00a0");
	}

	if (!inZone && now - practice.lastGood > FIRST_SOUNDS_GAP_MS && practice.holdMs > 0) {
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
		setPracticeFeedback(fs.cfg.longPassTitle || "What a long tone!", "\u00a0", "good");
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
	// Revisiting the result from the step chips doesn't pay out again
	if (!fs.awarded) {
		fs.awarded = true;
		recordProgress(15 * fs.done.filter(Boolean).length);
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
	if (!(stars > 0 && addPathNextButton(actions))) {
		actions.appendChild(practiceButton("Learn the first 3 notes \u2192", "primary", function() {
			startPracticeActivity(firstThreeActivity());
		}));
	}
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
//   Flute head joint: end open ≈ A5 (usually a little flat); covered by the
//     right palm ≈ A4, an octave lower; a covered head joint can also
//     overblow to E6. Real head joints vary (how far the palm seals, how far
//     the joint is pulled out, air angle), so both bands are wide: open
//     G5–B5, covered G4–B♭4 — still far from each other and from E6.
//   Clarinet: mouthpiece and barrel ≈ concert F♯5. (The mouthpiece alone
//     would be ≈ concert C6, but beginners start on the barrel.)
//   Alto sax: mouthpiece and neck ≈ concert A♭4, usually a bit above. (The
//     mouthpiece alone would be ≈ concert A5; beginners start on the neck.)
//   Brass mouthpiece buzz: the mouthpiece alone has no pitch of its own, so
//     the buzz goes wherever the lips do; beginners land all over. Each band
//     is about two and a half octaves (around the notes method books ask
//     for), so any real buzz passes and only a raspberry or a shriek misses.
//     The staff follows the note being buzzed.
//   Oboe reed crow: a good reed alone crows a C, usually C5 and C6 at once,
//     so the pitch can read as either; accepted B♭4–D6.
// Each sound is a step, then the final step: "switch" alternates the two
// sounds (both are possible on one setup); "long" holds the last sound for
// FIRST_SOUNDS_LONG_TONE_MS.
var FIRST_SOUNDS_STORAGE_KEY = "pitchdetect-first-five-headjoint";  // name predates clarinet/sax
var FIRST_SOUNDS_SWITCH_LENGTH = 6;
var FIRST_SOUNDS_SWITCH_HOLD_MS = 700;
var FIRST_SOUNDS_LONG_TONE_MS = 4000;
// Beginners' first sounds are breathy: moderate breath noise drops every
// frame below the usual 0.85 confidence gate while the measured pitch stays
// accurate, so this mode accepts less certain frames, and forgives longer
// dropouts in a hold.
var FIRST_SOUNDS_MIN_CONFIDENCE = 0.7;
var FIRST_SOUNDS_GAP_MS = 400;
var REED_TIPS_START = "Wet the reed, then put the reed and ligature on the mouthpiece.";

// A brass mouthpiece buzz tutorial: midi is the concert note the buzz
// centers on, low/high the accepted band in cents, placement the tip about
// where the mouthpiece sits on the lips
function brassBuzzConfig(drawing, midi, low, high, placement) {
	return {
		title: "Learn to buzz",
		sub: "Your first sounds: buzzing on the mouthpiece",
		icon: BRASS_ICON_SVG,
		setupTitle: "First sounds: just the mouthpiece!",
		tips: [
			"Take the mouthpiece out of the instrument and hold it by the stem.",
			"Say \u201cmm\u201d: lips together, corners firm, chin flat.",
			placement,
			"Blow fast air through your lips so they buzz, like a bee."
		],
		steps: ["Set up", "Buzz", "Hold"],
		final: "long",
		goodText: "That\u2019s a buzz! Keep it going\u2026",
		longPassTitle: "What a long buzz!",
		sounds: [
			{ midi: midi, low: low, high: high, drawing: drawing, follow: true, noExample: true,
				prompt: "Buzz into the mouthpiece.",
				idle: "Buzz and hold it",
				passTitle: "Great buzz!", passSub: "That\u2019s how every brass note starts" }
		],
		lowTitle: "Very low and floppy",
		lowHint: "Firm the corners of your lips and blow faster air",
		highTitle: "Very high",
		highHint: "Relax your lips a little and use slower air",
		noSoundHint: "No buzz yet? Take the mouthpiece away and buzz your lips alone first.",
		results: ["Buzz", "Long buzz"],
		doneTitle: "You can buzz!"
	};
}

var FIRST_SOUNDS = {
	"flute": {
		title: "Learn the head joint",
		sub: "Your first flute sounds: end open and covered",
		icon: FLUTE_ICON_SVG,
		setupTitle: "First sounds: just the head joint!",
		tips: [
			"Take the head joint off the flute.",
			"Hold it with your left hand and rest the lip plate against your bottom lip.",
			"Cover about a quarter of the hole with your bottom lip.",
			"Blow a gentle stream of air across the hole, like saying \u201ctoo.\u201d"
		],
		steps: ["Set up", "Open", "Covered", "Switch"],
		final: "switch",
		confusable: true,
		sounds: [
			{ midi: 81, low: -200, high: 100, drawing: "flute-open",
				prompt: "Leave the end open and blow.", switchPrompt: "Open!",
				idle: "Blow across the hole and hold it",
				passTitle: "Great open sound!", passSub: "That\u2019s about an A",
				otherHint: ["That\u2019s the covered sound", "Take your hand away from the end"] },
			{ midi: 69, low: -200, high: 150, drawing: "flute-covered", squeakMidi: 88,
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
	},
	"oboe": {
		title: "Learn the reed",
		sub: "Your first oboe sounds: a crow on the reed",
		icon: REED_ICON_SVG,
		setupTitle: "First sounds: just the reed!",
		tips: [
			"Soak the reed in a little water for 2\u20133 minutes.",
			"Hold it by the cork, never by the cane.",
			"Roll both lips over your teeth, like saying \u201coo.\u201d",
			"Put about a third of the cane in your mouth and blow fast air."
		],
		steps: ["Set up", "Crow", "Hold"],
		final: "long",
		goodText: "That\u2019s a crow! Keep it going\u2026",
		longPassTitle: "What a long crow!",
		sounds: [
			{ midi: 72, low: -200, high: 1400, drawing: "oboe-reed", follow: true, noExample: true,
				prompt: "Crow on the reed.",
				idle: "Blow and hold the crow",
				passTitle: "Great crow!", passSub: "A good reed crows a C" }
		],
		squeakHint: "Take less reed and don\u2019t bite",
		lowHint: "Take a little more reed and blow faster air",
		highHint: "Relax your lips \u2014 don\u2019t bite",
		noSoundHint: "No sound yet? Make sure the reed has soaked and the tip is open.",
		results: ["Reed crow", "Long crow"],
		doneTitle: "You can crow on the reed!"
	},
	"trumpet": brassBuzzConfig("mouthpiece-small", 67, -1200, 1700,
		"Center the mouthpiece on your lips: about half top lip, half bottom."),
	"horn": brassBuzzConfig("mouthpiece-small", 65, -1200, 1900,
		"Center the mouthpiece on your lips: about two thirds top lip, one third bottom."),
	"trombone": brassBuzzConfig("mouthpiece-large", 53, -1200, 1700,
		"Center the mouthpiece on your lips: about half top lip, half bottom."),
	"euphonium": brassBuzzConfig("mouthpiece-large", 53, -1200, 1700,
		"Center the mouthpiece on your lips: about half top lip, half bottom."),
	"tuba": brassBuzzConfig("mouthpiece-large", 46, -1200, 1500,
		"Center the mouthpiece on your lips, with lots of both lips inside the rim.")
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

// The whole celebration for one correct answer; noBalloons keeps it to the
// bounce and chime (the timed drills save the balloons for the end)
function celebrateCorrect(button, noBalloons) {
	if (button) {
		button.classList.remove("cheer");
		void button.offsetWidth;  // restart the bounce
		button.classList.add("cheer");
	}
	if (!noBalloons) launchBalloons();
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

// A balloon pop: a short burst of filtered noise, then the chime
function playPop() {
	try {
		if (!audioContext || audioContext.state === "closed") {
			audioContext = new (window.AudioContext || window.webkitAudioContext)();
		}
		if (audioContext.state !== "running") audioContext.resume();
		var t = audioContext.currentTime + 0.01;
		var length = Math.floor(audioContext.sampleRate * 0.08);
		var buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
		var data = buffer.getChannelData(0);
		for (var i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 4);
		var noise = audioContext.createBufferSource();
		noise.buffer = buffer;
		var filter = audioContext.createBiquadFilter();
		filter.type = "bandpass";
		filter.frequency.value = 1800;
		filter.Q.value = 0.8;
		var gain = audioContext.createGain();
		gain.gain.value = 0.6;
		noise.connect(filter);
		filter.connect(gain);
		gain.connect(audioContext.destination);
		noise.start(t);
	} catch (e) {
		// No audio available; the confetti still celebrates
	}
}

// Draw the note on a plain staff: no key signature, explicit flats, so a
// beginner sees exactly what to play
function drawPracticeStaff(writtenMidi, sharp) {
	var out = document.getElementById("practice-staff-output");
	out.innerHTML = "";
	var VF = Vex.Flow;
	var clef = getCurrentClef();
	// Lessons and quizzes leave room right of the note for the pitch trace
	var traced = practice && (practice.mode === "lesson" || practice.mode === "challenge");
	var W = traced ? PRACTICE_TRACE_STAFF_WIDTH : 170, H = STAFF_VIEWBOX_HEIGHT;
	if (!traced) pitchTrace = null;
	var renderer = new VF.Renderer(out, VF.Renderer.Backends.SVG);
	renderer.resize(W, H);
	var context = renderer.getContext();
	var stave = new VF.Stave(5, Math.round((H - 4 * LINE_SPACING) / 2), W - 10);
	stave.addClef(clef);
	stave.setContext(context).draw();

	var spelled = sharp ? sharpNoteSpellings[((writtenMidi % 12) + 12) % 12] : practiceSpelling(writtenMidi);
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
		note = null;
	}

	var svg = out.querySelector("svg");
	if (svg) {
		var center = (stave.getYForLine(0) + stave.getYForLine(4)) / 2;
		svg.setAttribute("viewBox", "0 " + (center - H / 2) + " " + W + " " + H);
		svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
		svg.style.width = "100%";
		svg.style.height = "100%";
		if (traced && note) setupPitchTrace(svg, note, writtenMidi, center - H / 2, H, stave.getNoteEndX());
	}
}

// Show (or with null, clear) the wrong note being played beside the target,
// redrawing the staff only when it changes. Lessons and quizzes have the
// pitch trace instead, which already shows where the wrong note is.
function setPracticeGhost(midi) {
	if (!practice || practice.ghost === midi || practice.step !== 3 || practice.mode !== "song") return;
	practice.ghost = midi;
	drawSongLine(practice.song.pos);
}

// The pitch trace: a band at the target note's height (the pass zone), and
// the pitch the student is playing drawn as a line flowing right from the
// note, newest at the right, ending in a dot. Height is staff position, so a
// wrong note or partial sits on its own line or space; within half a step
// the scale is zoomed in (PITCH_TRACE_FINE per 50¢) so a little sharp or flat
// shows plainly.
var pitchTrace = null;

function setupPitchTrace(svg, note, target, top, height, endX) {
	var ns = "http://www.w3.org/2000/svg";
	var headX = note.getAbsoluteX();
	var headW = note.getGlyphWidth();
	var g = document.createElementNS(ns, "g");
	g.setAttribute("class", "pitch-trace");
	g.setAttribute("aria-hidden", "true");
	// Under the staff lines and note, so they read over it
	svg.insertBefore(g, svg.firstChild);
	var band = document.createElementNS(ns, "rect");
	band.setAttribute("class", "pitch-trace-band");
	var lines = {};
	g.appendChild(band);
	["good", "close", "off"].forEach(function(state) {
		var p = document.createElementNS(ns, "path");
		p.setAttribute("class", "pitch-trace-line");
		p.setAttribute("data-state", state);
		g.appendChild(p);
		lines[state] = p;
	});
	// The dot goes on top of everything
	var dot = document.createElementNS(ns, "path");
	dot.setAttribute("class", "pitch-trace-dot");
	svg.appendChild(dot);

	var y = note.getYs()[0];
	var bandH = PRACTICE_PASS_CENTS / 50 * PITCH_TRACE_FINE;
	band.setAttribute("x", headX - 4);
	band.setAttribute("width", endX - headX + 4);
	band.setAttribute("y", y - bandH);
	band.setAttribute("height", 2 * bandH);
	band.setAttribute("rx", bandH);

	var partials = brassPartials(target);
	var old = pitchTrace;
	pitchTrace = {
		target: target, y: y, top: top + 5, bottom: top + height - 5,
		x0: headX + headW + 6, x1: endX - (partials ? PITCH_LADDER_WIDTH : 6),
		points: old && old.target === target ? old.points : [],
		smooth: old && old.target === target ? old.smooth : null,
		lastSound: old && old.target === target ? old.lastSound : 0,
		band: band, lines: lines, dot: dot, ladder: null
	};
	if (partials) setupPitchLadder(svg, g, partials);
	renderPitchTrace(performance.now());
}

// The partial ladder (brass): a rung at the height of each note the target's
// fingering plays, named, at the right end of the trace, so the dot points at
// the rung the student is on. Heights use the trace's scale, so the target's
// rung sits in its band.
function setupPitchLadder(svg, g, partials) {
	var ns = "http://www.w3.org/2000/svg";
	var tr = pitchTrace;
	var left = tr.x1 + 5, right = left + 12;
	var ladder = document.createElementNS(ns, "g");
	ladder.setAttribute("class", "pitch-ladder");
	g.appendChild(ladder);
	var rungs = [];
	partials.forEach(function(midi) {
		// A partial or two either way is where a beginner's misses land
		if (Math.abs(midi - tr.target) > PITCH_LADDER_RANGE) return;
		var y = tr.y - pitchTraceOffset(midi - tr.target);
		if (y < tr.top || y > tr.bottom) return;
		var target = Math.abs(midi - tr.target) < 0.5;
		// Top partials crowd together; keep the target's, else the first
		var near = rungs.filter(function(r) { return Math.abs(r.y - y) < 5.5; })[0];
		if (near) {
			if (!target) return;
			rungs.splice(rungs.indexOf(near), 1);
		}
		rungs.push({ midi: midi, y: y, target: target });
	});
	if (!rungs.length) return;
	rungs.sort(function(a, b) { return a.y - b.y; });
	var rails = document.createElementNS(ns, "path");
	rails.setAttribute("class", "pitch-ladder-rail");
	var y0 = rungs[0].y - 3, y1 = rungs[rungs.length - 1].y + 3;
	rails.setAttribute("d", "M" + left + " " + y0 + "V" + y1 + "M" + right + " " + y0 + "V" + y1);
	ladder.appendChild(rails);
	rungs.forEach(function(r) {
		var line = document.createElementNS(ns, "path");
		line.setAttribute("class", "pitch-ladder-rung");
		line.setAttribute("d", "M" + left + " " + r.y.toFixed(1) + "H" + right);
		if (r.target) line.setAttribute("data-target", "1");
		ladder.appendChild(line);
		var label = document.createElementNS(ns, "text");
		label.setAttribute("class", "pitch-ladder-label");
		label.setAttribute("x", right + 3);
		label.setAttribute("y", (r.y + 2.6).toFixed(1));
		label.textContent = practiceNoteName(Math.round(r.midi));
		if (r.target) label.setAttribute("data-target", "1");
		ladder.appendChild(label);
		r.line = line;
		r.label = label;
	});
	tr.ladder = { el: ladder, rungs: rungs };
}

function pitchTraceActive() {
	return !!pitchTrace && !!practice && practice.step === 3 &&
		(practice.mode === "lesson" || practice.mode === "challenge");
}

// The staff step (diatonic, half a space each) of a written note, as the
// practice staff spells it
function practiceStaffStep(midi) {
	var spelled = practiceSpelling(midi);
	var alter = spelled.length > 1 ? (spelled.charAt(1) === "#" ? 1 : -1) : 0;
	var natural = midi - alter;
	return (Math.floor(natural / 12) - 1) * 7 + "CDEFGAB".indexOf(spelled.charAt(0));
}

// Height above the target, in staff units, for a pitch diff semitones from it
function pitchTraceOffset(diff) {
	var t = pitchTrace.target, x = t + diff, n = Math.floor(x);
	var a = practiceStaffStep(n), b = practiceStaffStep(n + 1);
	var staff = (a + (b - a) * (x - n) - practiceStaffStep(t)) * LINE_SPACING / 2;
	var fine = Math.max(-0.5, Math.min(0.5, diff)) * 2 * PITCH_TRACE_FINE;
	// Both grow with the diff, so the larger keeps the line moving one way
	return Math.abs(staff) > Math.abs(fine) ? staff : fine;
}

function pitchTraceState(diff) {
	if (Math.abs(diff) * 100 <= PRACTICE_PASS_CENTS) return "good";
	return Math.round(diff) === 0 ? "close" : "off";
}

function clearPitchTrace() {
	if (!pitchTrace) return;
	pitchTrace.points = [];
	pitchTrace.smooth = null;
	pitchTrace.lastSound = 0;
	renderPitchTrace(performance.now());
}

// Called from the mic loop each frame while the trace is up: diff is the
// pitch in semitones from the target, null for no confident pitch
function pushPitchTrace(now, diff) {
	if (!pitchTraceActive()) return;
	var tr = pitchTrace;
	if (diff !== null) {
		// Smooth the wobble frame to frame, but jump straight to another note
		tr.smooth = tr.smooth === null || now - tr.lastSound > PITCH_TRACE_BREAK_MS || Math.abs(diff - tr.smooth) > 0.7
			? diff : tr.smooth + PITCH_TRACE_SMOOTHING * (diff - tr.smooth);
		tr.lastSound = now;
		tr.points.push({ t: now, d: tr.smooth });
	} else if (now - tr.lastSound > PITCH_TRACE_BREAK_MS && tr.points.length && tr.points[tr.points.length - 1].d !== null) {
		tr.points.push({ t: now, d: null });
	}
	while (tr.points.length && tr.points[0].t < now - PITCH_TRACE_MS) tr.points.shift();
	renderPitchTrace(now);
}

function renderPitchTrace(now) {
	var tr = pitchTrace;
	if (!tr || !tr.band.isConnected) return;
	var active = pitchTraceActive();
	tr.band.style.display = active ? "" : "none";
	if (tr.ladder) tr.ladder.el.style.display = active ? "" : "none";
	var paths = { good: "", close: "", off: "" };
	var prev = null, prevXY = null;
	var span = tr.x1 - tr.x0;
	function xy(p) {
		var y = tr.y - pitchTraceOffset(p.d);
		return [tr.x1 - (now - p.t) / PITCH_TRACE_MS * span, Math.max(tr.top, Math.min(tr.bottom, y)), y];
	}
	if (active) {
		tr.points.forEach(function(p) {
			if (p.d === null) { prev = null; return; }
			var c = xy(p);
			if (prev) {
				paths[pitchTraceState(p.d)] += "M" + prevXY[0].toFixed(1) + " " + prevXY[1].toFixed(1) +
					"L" + c[0].toFixed(1) + " " + c[1].toFixed(1);
			}
			prev = p;
			prevXY = c;
		});
	}
	for (var state in paths) tr.lines[state].setAttribute("d", paths[state]);

	// The dot: the pitch now, held through short dropouts like the note panel
	var last = active && tr.points.length ? tr.points[tr.points.length - 1] : null;
	var sounding = !!last && last.d !== null && now - tr.lastSound <= NOTE_CLEAR_HOLD_MS;
	// The rung being played lights up: green on the target, red elsewhere
	if (tr.ladder) {
		tr.ladder.rungs.forEach(function(r) {
			var on = sounding && Math.abs(tr.target + last.d - r.midi) < 0.5;
			var state = on ? pitchTraceState(last.d) : "";
			r.line.setAttribute("data-state", state);
			r.label.setAttribute("data-state", state);
		});
	}
	if (!sounding) {
		tr.dot.setAttribute("d", "");
		return;
	}
	var p = xy({ t: now, d: last.d });
	var x = p[0], y = p[1], r = 3.2;
	tr.dot.setAttribute("data-state", pitchTraceState(last.d));
	if (p[2] < tr.top || p[2] > tr.bottom) {
		// Off the staff's view: an arrow at the edge pointing to where it is
		var s = p[2] < tr.top ? -1 : 1;
		tr.dot.setAttribute("d", "M" + (x - 4) + " " + (y - 2 * s) + "L" + (x + 4) + " " + (y - 2 * s) +
			"L" + x + " " + (y + 4 * s) + "Z");
	} else {
		tr.dot.setAttribute("d", "M" + (x - r) + " " + y + "a" + r + " " + r + " 0 1 0 " + (2 * r) +
			" 0a" + r + " " + r + " 0 1 0 " + (-2 * r) + " 0");
	}
}

// A faint whole note for the wrong note played, just right of the target (a
// formatted StaveNote), so the two read side by side: here vs. there
function drawPracticeGhost(context, stave, clef, midi, target) {
	var VF = Vex.Flow;
	var spelled = practiceSpelling(midi);
	var g = new VF.StaveNote({ clef: clef, keys: [spelled.toLowerCase() + "/" + (Math.floor(midi / 12) - 1)], duration: "w" });
	if (spelled.length > 1) g.addAccidental(0, new VF.Accidental(spelled.charAt(1)));
	var color = "rgba(100, 116, 139, 0.55)";
	g.setStyle({ fillStyle: color, strokeStyle: color });
	g.setLedgerLineStyle({ fillStyle: color, strokeStyle: color });
	g.setStave(stave);
	var tc = new VF.TickContext();
	tc.addTickable(g).preFormat().setX(0);
	// Clear of the target's head, and room for its own accidental
	var want = target.getAbsoluteX() + target.getGlyphWidth() + 6 + (spelled.length > 1 ? 10 : 0);
	tc.setX(want - g.getAbsoluteX());
	context.openGroup("practice-ghost");
	g.setContext(context).draw();
	context.closeGroup();
}

document.addEventListener("keydown", function(event) {
	if (!practiceOpen) return;
	if (event.key === "Escape" && tuningTipOpen()) closeTuningTip();
	else if (event.key === "Escape") practiceBack();
	else if (practice && practice.mode === "editor") editorKeyDown(event);
});

// Browser history mirrors the practice screens, so the phone's back button
// (Android) or edge swipe (iPhone) steps back like the back arrow: app <
// menu (any page) < activity < song. Each screen has a depth; moving deeper
// pushes an entry (always from a tap, so browsers don't skip it), moving
// sideways replaces it, and moving shallower (the back arrow, Escape, a
// "Back to the menu" button) goes back through history to that entry. The
// map is the top; a unit or tab is a level under it, and the profile (from
// the map's player bar) is too.
function practiceHistoryState() {
	if (!practiceOpen || !practice) return null;
	var activity = currentPracticeActivity();
	if (activity === "menu") {
		// A unit's card on the map is a level under it, like the unit's page
		if (practice.menuPage === "map" && practice.mapSummary) {
			return { practice: "menu", page: "map", summary: practice.mapSummary, depth: 2 };
		}
		return { practice: "menu", page: practice.menuPage, depth: practice.menuPage === "map" ? 1 : 2 };
	}
	// Sign-in on opening stands in for the map; from the profile it's a level deeper
	if (activity === "signin") return { practice: "signin", depth: practice.signinFrom === "profile" ? 3 : 1 };
	if (activity === "profile") return { practice: "profile", depth: 2 };
	var depth = 3;
	if (practice.mode === "song") return { practice: "song", song: practice.song.id, free: !!practice.song.free, depth: depth + 1 };
	if (practice.mode === "editor") return { practice: "editor", song: practice.editor.song.id, depth: depth + 1 };
	if (practice.mode === "songs") return { practice: "songs", depth: depth };
	return { practice: activity, depth: depth };
}

function practiceHistoryDepth(state) {
	return state && state.practice ? state.depth : 0;
}

function samePracticeState(a, b) {
	if (!a || !a.practice) return !b;
	return !!b && a.practice === b.practice && a.page === b.page && a.song === b.song && !a.free === !b.free &&
		(a.summary || null) === (b.summary || null);
}

// Set while a history.go() of ours is on its way, so its popstate syncs
// history to the screen rather than the screen to history: the screen may
// have moved on meanwhile (a result's Next step from a song lands on an
// activity, not the song list)
var practiceHistoryGoing = false;

function syncPracticeHistory() {
	if (practiceHistoryGoing) return;
	var want = practiceHistoryState();
	var depth = practiceHistoryDepth(want);
	var have = practiceHistoryDepth(history.state);
	if (depth > have) {
		history.pushState(want, "");
	} else if (depth < have) {
		// Land on the ancestor entry, then catch up with the screen
		practiceHistoryGoing = true;
		history.go(depth - have);
	} else if (want && !samePracticeState(history.state, want)) {
		history.replaceState(want, "");
	}
}

// Screens change mode partway through their setup, so sync once they're done
var practiceHistorySyncQueued = false;
function schedulePracticeHistorySync() {
	if (practiceHistorySyncQueued) return;
	practiceHistorySyncQueued = true;
	Promise.resolve().then(function() {
		practiceHistorySyncQueued = false;
		syncPracticeHistory();
	});
}

// Back (or forward) through history: show the screen the entry names
window.addEventListener("popstate", function(event) {
	if (practiceHistoryGoing) {
		practiceHistoryGoing = false;
		syncPracticeHistory();
		return;
	}
	var state = event.state && event.state.practice ? event.state : null;
	if (samePracticeState(state, practiceHistoryState())) return;
	if (!state) {
		closePractice();
		return;
	}
	if (!practiceOpen) {
		openPractice();
		if (!practiceOpen) return;
	}
	if (state.practice === "menu") {
		showPracticeMenu(state.page);
		if (state.summary && state.page === "map") showUnitSummary(state.summary);
	}
	else if (state.practice === "signin" && !practiceSignedIn()) showSignIn("open");
	else if (state.practice === "signin" && !practice.instrument) showInstrumentStep("open");
	else if (state.practice === "signin") showPracticeMenu();
	else if (state.practice === "songs") showSongList();
	else if (state.practice === "song" && findSong(state.song)) {
		if (state.free) playThroughSong(state.song); else startSong(state.song);
	}
	else if (state.practice === "editor" && findSong(state.song)) openSongEditor(state.song);
	else if (state.practice !== "song" && state.practice !== "editor" && state.practice !== "import") startPracticeActivity(state.practice);
	else showSongList();
});

// A reload keeps the history entries but starts on the app, so return to
// the app's own entry
if (history.state && history.state.practice) history.go(-history.state.depth);
