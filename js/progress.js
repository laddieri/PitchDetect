/*
 * Progress: the game layer over practice. Loaded after firstfive.js.
 *
 * Students: a student types their student ID on the sign-in screen
 * (showSignIn()), or practices as a guest. Everything is kept on this device
 * only (no server): every practice storage key gets "@<ID>" appended
 * (studentKey()), so several students can share a Chromebook or iPad, each
 * with their own stars, songs and level. A guest uses the plain keys, so
 * progress from before sign-in existed stays with the guest. The last
 * student stays signed in (pitchdetect-student) until someone switches.
 *
 * The profile (pitchdetect-profile, per student): XP and level, daily
 * practice time, the daily goal and streak, badges, avatar, instrument.
 *   - XP comes from finishing things (recordProgress(), called by the result
 *     handlers in firstfive.js), reaching the daily goal and earning badges.
 *     Levels get a little further apart each time (levelForXp()).
 *   - Practice time counts seconds of active practice: an activity (or the
 *     mic) open with a sound or a tap in the last ACTIVE_WINDOW_MS. So the
 *     app left open on a menu doesn't count.
 *   - The streak counts days in a row the daily goal was reached. A missed
 *     day uses a streak freeze if there's one (one earned every 7 days, up
 *     to MAX_FREEZES), so a weekend off doesn't wipe it out.
 *   - Badges (BADGES) are tested against the current instrument's progress
 *     and the profile (checkBadges()).
 *   - The learning path (learningPath()) orders the practice activities;
 *     the menu marks the next one, and the profile lists them all. Nothing
 *     is locked: the path is a guide, so a teacher can send students anywhere.
 */

var STUDENT_STORAGE_KEY = "pitchdetect-student";
var PROFILE_STORAGE_KEY = "pitchdetect-profile";
var DAILY_GOAL_OPTIONS = [5, 10, 15, 20];  // minutes
var DEFAULT_DAILY_GOAL = 10;
var ACTIVE_WINDOW_MS = 15000;  // practice counts this long after a sound or tap
var MAX_FREEZES = 2;
var GOAL_XP = 30;
var BADGE_XP = 20;
var NEW_BEST_XP = 10;
var PROFILE_KEEP_DAYS = 400;   // daily practice times older than this are dropped

// Avatars, each unlocked at a level
var AVATARS = [
	{ icon: "\uD83D\uDC36", level: 1 }, { icon: "\uD83D\uDC31", level: 1 }, { icon: "\uD83D\uDC38", level: 1 },
	{ icon: "\uD83E\uDD8A", level: 2 }, { icon: "\uD83D\uDC3C", level: 3 }, { icon: "\uD83D\uDC2F", level: 4 },
	{ icon: "\uD83D\uDC28", level: 5 }, { icon: "\uD83E\uDD81", level: 6 }, { icon: "\uD83E\uDD89", level: 7 },
	{ icon: "\uD83D\uDC19", level: 8 }, { icon: "\uD83E\uDD84", level: 10 }, { icon: "\uD83D\uDC09", level: 12 }
];

var LEVEL_TITLES = ["New Musician", "Note Finder", "Practice Pal", "Rhythm Rookie",
	"Band Member", "Melody Maker", "Section Star", "Soloist", "Section Leader",
	"Principal Player", "Band Captain", "Maestro"];

// Badges: test(s) gets progressSnapshot(); available() hides a badge the
// current instrument can't earn (unless it's already earned)
var BADGES = [
	{ id: "first-note", icon: "\uD83C\uDFB5", name: "First Note", how: "Earn a star on any note",
		test: function(s) { return s.first5.concat(s.scale).some(function(n) { return n > 0; }); } },
	{ id: "five-alive", icon: "\u270B", name: "Five Alive", how: "Learn all of the first 5 notes",
		test: function(s) { return s.first5.every(function(n) { return n > 0; }); } },
	{ id: "gold-stars", icon: "\u2B50", name: "Gold Stars", how: "Get 3 stars on each of the first 5 notes",
		test: function(s) { return s.first5.every(function(n) { return n === 3; }); } },
	{ id: "quiz-whiz", icon: "\uD83C\uDFC6", name: "Quiz Whiz", how: "Play every note of the quiz on your own",
		test: function(s) { return s.quizBest >= CHALLENGE_LENGTH; } },
	{ id: "scale-climber", icon: "\uD83D\uDCC8", name: "Scale Climber", how: "Learn all 8 notes of the B\u266D scale",
		test: function(s) { return s.scale.every(function(n) { return n > 0; }); } },
	{ id: "scale-master", icon: "\uD83D\uDC51", name: "Scale Master", how: "Play the B\u266D scale up and down on your own",
		test: function(s) { return s.scaleRunBest >= s.scaleRunLength; } },
	{ id: "first-song", icon: "\uD83C\uDFB6", name: "First Song", how: "Finish a song",
		test: function(s) { return s.songsFinished > 0; } },
	{ id: "perfect-song", icon: "\uD83D\uDCAF", name: "Perfect Performance", how: "Play a whole song with every note right",
		test: function(s) { return s.perfectSong; } },
	{ id: "songbook", icon: "\uD83D\uDCD6", name: "Songbook", how: "Earn stars on 5 different songs",
		test: function(s) { return s.songsStarred >= 5; } },
	{ id: "composer", icon: "\u270F\uFE0F", name: "Composer", how: "Write a song of your own",
		test: function(s) { return s.customSongs > 0; } },
	{ id: "quick-reader", icon: "\u26A1", name: "Quick Reader", how: "Name 10 notes in one note name round",
		test: function(s) { return s.namesBest >= 10; } },
	{ id: "fast-fingers", icon: "\uD83D\uDD90\uFE0F", name: "Fast Fingers", how: "Name 10 fingerings in one round",
		test: function(s) { return s.fingeringsBest >= 10; } },
	{ id: "first-sounds", icon: "\uD83C\uDF2C\uFE0F", name: "First Sounds", how: "Finish every part of first sounds",
		test: function(s) { return s.firstSounds >= 3; },
		available: function() { return !!FIRST_SOUNDS[practice.instrument]; } },
	{ id: "goal", icon: "\uD83C\uDFAF", name: "Goal!", how: "Reach your daily practice goal",
		test: function(s) { return s.bestStreak > 0; } },
	{ id: "on-a-roll", icon: "\uD83D\uDD25", name: "On a Roll", how: "Reach your goal 3 days in a row",
		test: function(s) { return s.bestStreak >= 3; } },
	{ id: "week-warrior", icon: "\uD83D\uDCC5", name: "Week Warrior", how: "Reach your goal 7 days in a row",
		test: function(s) { return s.bestStreak >= 7; } },
	{ id: "legend", icon: "\uD83C\uDF1F", name: "Practice Legend", how: "Reach your goal 30 days in a row",
		test: function(s) { return s.bestStreak >= 30; } },
	{ id: "first-hour", icon: "\u23F0", name: "First Hour", how: "Practice 60 minutes in all",
		test: function(s) { return s.totalSeconds >= 3600; } },
	{ id: "ten-hours", icon: "\uD83C\uDF96\uFE0F", name: "Ten Hours", how: "Practice 10 hours in all",
		test: function(s) { return s.totalSeconds >= 36000; } }
];

// The student ID signed in on this device, "" for a guest, or null before
// anyone has chosen
var currentStudent = null;
try { currentStudent = localStorage.getItem(STUDENT_STORAGE_KEY); } catch (e) {}
var profile = null;
var lastPracticeActivity = 0;
var profileUnsavedSeconds = 0;

// A practice storage key for the student signed in
function studentKey(key) {
	return currentStudent ? key + "@" + currentStudent : key;
}

// A typed student ID, tidied (spaces and dashes dropped, letters upper
// case), or null if it isn't 3 to 12 letters and numbers
function normalizeStudentId(text) {
	var id = String(text || "").replace(/[\s-]/g, "").toUpperCase();
	return /^[A-Z0-9]{3,12}$/.test(id) ? id : null;
}

// A typed first name, tidied: no control characters, spaces collapsed, at
// most STUDENT_NAME_MAX characters ("" if none). It's only ever shown as
// text, never as HTML.
var STUDENT_NAME_MAX = 20;
function cleanStudentName(text) {
	return String(text || "").replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ")
		.trim().slice(0, STUDENT_NAME_MAX).trim();
}

function nonNegative(n) {
	return typeof n === "number" && isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function loadProfile() {
	var p = null;
	try { p = JSON.parse(localStorage.getItem(studentKey(PROFILE_STORAGE_KEY)) || "null"); } catch (e) {}
	if (!p || typeof p !== "object") p = {};
	var days = {};
	if (p.days && typeof p.days === "object") {
		Object.keys(p.days).forEach(function(d) {
			if (/^\d{4}-\d\d-\d\d$/.test(d)) days[d] = nonNegative(p.days[d]);
		});
	}
	return {
		xp: nonNegative(p.xp),
		avatar: nonNegative(p.avatar) < AVATARS.length ? nonNegative(p.avatar) : 0,
		goal: DAILY_GOAL_OPTIONS.indexOf(p.goal) >= 0 ? p.goal : DEFAULT_DAILY_GOAL,
		days: days,
		streak: nonNegative(p.streak),
		bestStreak: nonNegative(p.bestStreak),
		lastGoalDay: typeof p.lastGoalDay === "string" ? p.lastGoalDay : null,
		freezes: Math.min(MAX_FREEZES, nonNegative(p.freezes)),
		badges: p.badges && typeof p.badges === "object" ? p.badges : {},
		instrument: typeof p.instrument === "string" ? p.instrument : null,
		name: cleanStudentName(p.name)
	};
}

function saveProfile() {
	if (!profile) return;
	profileUnsavedSeconds = 0;
	var cutoff = addDays(dayKey(new Date()), -PROFILE_KEEP_DAYS);
	Object.keys(profile.days).forEach(function(d) {
		if (d < cutoff) delete profile.days[d];
	});
	try { localStorage.setItem(studentKey(PROFILE_STORAGE_KEY), JSON.stringify(profile)); } catch (e) {}
}

// ---------------------------------------------------------------------------
// Days, practice time and the streak
// ---------------------------------------------------------------------------

// "2026-10-07" for a date, in local time
function dayKey(date) {
	var m = date.getMonth() + 1, d = date.getDate();
	return date.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (d < 10 ? "0" : "") + d;
}

function dayDate(key) {
	var parts = key.split("-");
	return new Date(+parts[0], parts[1] - 1, +parts[2]);
}

function addDays(key, n) {
	var date = dayDate(key);
	date.setDate(date.getDate() + n);
	return dayKey(date);
}

function daysBetween(a, b) {
	return Math.round((dayDate(b) - dayDate(a)) / 86400000);
}

// Catch the streak up to today: days missed since the goal was last reached
// use freezes if there are enough, otherwise the streak starts over
function settleStreak() {
	if (!profile || !profile.lastGoalDay || !profile.streak) return;
	var today = dayKey(new Date());
	var missed = daysBetween(profile.lastGoalDay, today) - 1;
	if (missed <= 0) return;
	if (missed <= profile.freezes) {
		profile.freezes -= missed;
		profile.lastGoalDay = addDays(today, -1);
	} else {
		profile.streak = 0;
	}
	saveProfile();
}

function currentStreak() {
	settleStreak();
	return profile ? profile.streak : 0;
}

function secondsToday() {
	return profile ? profile.days[dayKey(new Date())] || 0 : 0;
}

function totalSeconds() {
	return Object.keys(profile.days).reduce(function(t, d) { return t + profile.days[d]; }, 0);
}

// "7 min" / "1 h 5 min"
function formatPracticeTime(seconds) {
	var m = Math.floor(seconds / 60);
	return m < 60 ? m + " min" : Math.floor(m / 60) + " h " + (m % 60) + " min";
}

// A sound from the mic or a tap in practice: practice is happening
function markPracticeActive() {
	lastPracticeActivity = Date.now();
}

// Whether time spent now counts as practice: an activity open (not a menu
// or list) or the mic on
function practicing() {
	if (listenActive) return true;
	return practiceOpen && !!practice &&
		["lesson", "challenge", "drill", "song", "editor", "firstsounds"].indexOf(practice.mode) >= 0;
}

function practiceTick() {
	if (!profile || currentStudent === null || document.hidden) return;
	if (Date.now() - lastPracticeActivity > ACTIVE_WINDOW_MS || !practicing()) return;
	var today = dayKey(new Date());
	var before = profile.days[today] || 0;
	profile.days[today] = before + 1;
	if (before < profile.goal * 60 && before + 1 >= profile.goal * 60) {
		reachDailyGoal(today);
	} else if (++profileUnsavedSeconds >= 10) {
		saveProfile();
	}
}

function reachDailyGoal(today) {
	settleStreak();
	if (profile.lastGoalDay === today) return;
	profile.streak++;
	profile.lastGoalDay = today;
	profile.bestStreak = Math.max(profile.bestStreak, profile.streak);
	var freeze = profile.streak % 7 === 0 && profile.freezes < MAX_FREEZES;
	if (freeze) profile.freezes++;
	saveProfile();
	var text = "Daily goal! \uD83D\uDD25 " + profile.streak + " day" + (profile.streak === 1 ? "" : "s");
	if (practiceOpen) {
		showProgressPop(text, "goal");
		if (freeze) showProgressPop("\u2744\uFE0F Streak freeze earned!", "badge");
		playChime();
	} else {
		showToast(text + (freeze ? " \u00B7 streak freeze earned!" : ""), 3000);
	}
	awardXp(GOAL_XP + BADGE_XP * earnBadges());
}

// ---------------------------------------------------------------------------
// XP, levels and badges
// ---------------------------------------------------------------------------

// { level, into: XP into this level, need: XP this level takes }
function levelForXp(xp) {
	var level = 1, base = 0, need = 100;
	while (xp >= base + need) {
		base += need;
		level++;
		need = 50 + 50 * level;
	}
	return { level: level, into: xp - base, need: need };
}

function levelTitle(level) {
	return LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length) - 1];
}

// Add XP; quiet skips the "+XP" pop and the level-up card
function awardXp(amount, quiet) {
	if (!profile || amount <= 0) return;
	var before = levelForXp(profile.xp).level;
	profile.xp += amount;
	saveProfile();
	var after = levelForXp(profile.xp).level;
	if (!quiet && practiceOpen) showProgressPop("+" + amount + " XP", "xp");
	if (!quiet && after > before) setTimeout(function() { showLevelUp(after); }, 900);
	updatePlayerBar();
}

// Called by the activities when they finish: any badges it earned, then
// one XP award for what was done and the badges
function recordProgress(xp) {
	if (currentStudent === null) return;
	awardXp(xp + BADGE_XP * earnBadges());
}

// Facts the badges are tested against: the current instrument's practice
// state plus the profile
function progressSnapshot() {
	var s = {
		first5: practice.lessons.first5.stars,
		scale: practice.lessons.scale.stars,
		quizBest: practice.challengeBest || 0,
		scaleRunBest: practice.scaleRunBest || 0,
		scaleRunLength: scaleRunSequence().length,
		namesBest: practice.drillBest.names || 0,
		fingeringsBest: practice.drillBest.fingerings || 0,
		firstSounds: practice.firstSoundsBest || 0,
		customSongs: practice.customSongs.length,
		songsFinished: 0,
		songsStarred: 0,
		perfectSong: false,
		bestStreak: profile.bestStreak,
		totalSeconds: totalSeconds()
	};
	SONGS.concat(practice.customSongs).forEach(function(song) {
		var best = practice.songBest[song.id];
		if (typeof best !== "number") return;
		var count = songNotes(song).length;
		s.songsFinished++;
		if (count && best >= count) s.perfectSong = true;
		if (challengeStars(best, count) > 0) s.songsStarred++;
	});
	return s;
}

// Mark any badges now due as earned (with a pop unless quiet); returns how
// many, for the caller to award their XP
function earnBadges(quiet) {
	if (!practice || !profile || currentStudent === null) return 0;
	var s = progressSnapshot();
	var earned = BADGES.filter(function(b) {
		return !profile.badges[b.id] && b.test(s);
	});
	earned.forEach(function(b) {
		profile.badges[b.id] = dayKey(new Date());
		if (!quiet && practiceOpen) showProgressPop(b.icon + " " + b.name + "!", "badge");
	});
	if (earned.length) saveProfile();
	return earned.length;
}

// Earn any badges now due, with their XP. quiet: no pops (progress from
// before badges existed, found when an instrument loads)
function checkBadges(quiet) {
	var count = earnBadges(quiet);
	if (count) awardXp(BADGE_XP * count, quiet);
}

// Short messages floating up under the practice header ("+30 XP", a badge),
// one after another so they don't pile up
var progressPopQueue = [];
var progressPopTimer = null;
var PROGRESS_POP_GAP_MS = 1100;

function showProgressPop(text, kind) {
	progressPopQueue.push({ text: text, kind: kind });
	if (!progressPopTimer) nextProgressPop();
}

function nextProgressPop() {
	var item = progressPopQueue.shift();
	var layer = document.getElementById("progress-pops");
	if (!item || !layer || !practiceOpen) {
		progressPopQueue = [];
		progressPopTimer = null;
		return;
	}
	var pop = document.createElement("div");
	pop.className = "progress-pop " + item.kind;
	pop.textContent = item.text;
	layer.appendChild(pop);
	setTimeout(function() { pop.remove(); }, 2600);
	progressPopTimer = setTimeout(nextProgressPop, PROGRESS_POP_GAP_MS);
}

function showLevelUp(level) {
	var card = document.getElementById("level-up");
	if (!card || !practiceOpen) return;
	var unlocked = AVATARS.filter(function(a) { return a.level === level; });
	card.querySelector(".level-up-number").textContent = level;
	card.querySelector(".level-up-title").textContent = levelTitle(level);
	card.querySelector(".level-up-unlock").textContent = unlocked.length
		? "New avatar: " + unlocked.map(function(a) { return a.icon; }).join(" ") : "";
	card.hidden = false;
	card.querySelector("button").focus();
	playChime();
}

function closeLevelUp() {
	document.getElementById("level-up").hidden = true;
}

// ---------------------------------------------------------------------------
// The learning path
// ---------------------------------------------------------------------------

// Beginner/intermediate/advanced songs with at least one star
function songsStarredAt(level) {
	return SONGS.filter(function(song) { return song.level === level && songStars(song) > 0; }).length;
}

// The path for the current instrument: [{ title, activity, done, level? }]
function learningPath() {
	var nodes = [];
	var fs = FIRST_SOUNDS[practice.instrument];
	if (fs) nodes.push({ title: fs.title, activity: "firstsounds", done: practice.firstSoundsBest >= 3 });
	var first5 = practice.lessons.first5;
	first5.notes.forEach(function(midi, i) {
		nodes.push({ title: "Learn " + practiceNoteName(midi), activity: "learn", done: first5.stars[i] > 0 });
	});
	var drillDone = function(kind) { return challengeStars(practice.drillBest[kind] || 0, DRILL_STAR_GOAL) > 0; };
	nodes.push({ title: "Take the first 5 note quiz", activity: "quiz",
		done: challengeStars(practice.challengeBest || 0) > 0 });
	nodes.push({ title: "Practice note names", activity: "names", done: drillDone("names") });
	nodes.push({ title: practice.instrument === "trombone" ? "Practice slide positions"
		: hasFingeringData(practice.instrument) ? "Practice fingerings" : "Practice the keyboard",
		activity: "fingerings", done: drillDone("fingerings") });
	nodes.push({ title: "Play 3 beginner songs", activity: "songs", level: "beginner",
		done: songsStarredAt("beginner") >= 3 });
	nodes.push({ title: "Learn the B\u266D scale", activity: "scale",
		done: practice.lessons.scale.stars.every(function(n) { return n > 0; }) });
	nodes.push({ title: "Play the B\u266D scale", activity: "scalerun",
		done: challengeStars(practice.scaleRunBest || 0, scaleRunSequence().length) > 0 });
	nodes.push({ title: "Play 3 intermediate songs", activity: "songs", level: "intermediate",
		done: songsStarredAt("intermediate") >= 3 });
	nodes.push({ title: "Play 3 advanced songs", activity: "songs", level: "advanced",
		done: songsStarredAt("advanced") >= 3 });
	return nodes;
}

function nextPathNode(nodes) {
	return (nodes || learningPath()).filter(function(n) { return !n.done; })[0] || null;
}

function startPathNode(node) {
	if (node.level) songLevelsOpen[node.level] = true;
	startPracticeActivity(node.activity);
}

// Mark the menu card (or the More button) for the next step on the path
function markNextUp(menu, page) {
	var more = document.getElementById("practice-more");
	more.classList.remove("next-up");
	if (currentStudent === null) return;
	var next = nextPathNode();
	if (!next) return;
	var card = menu.querySelector('[data-activity="' + next.activity + '"]');
	if (card) {
		card.classList.add("next-up");
		var tag = document.createElement("span");
		tag.className = "next-up-tag";
		tag.textContent = "Next";
		card.appendChild(tag);
	} else if (page === "main" && isMoreActivity(next.activity)) {
		more.classList.add("next-up");
	}
}

// ---------------------------------------------------------------------------
// Screens: the player bar on the menu, the profile, sign-in
// ---------------------------------------------------------------------------

// The student's name, or their ID until they've given one
function studentLabel() {
	if (profile && profile.name) return profile.name;
	return currentStudent ? "Student " + currentStudent : "Guest";
}

function goalRingStyle(el, seconds) {
	var frac = Math.min(1, seconds / (profile.goal * 60));
	el.style.setProperty("--goal", (frac * 360).toFixed(1) + "deg");
	el.classList.toggle("met", frac >= 1);
}

function updatePlayerBar() {
	var bar = document.getElementById("player-bar");
	if (!bar || !profile) return;
	var lv = levelForXp(profile.xp);
	bar.querySelector(".player-avatar").textContent = AVATARS[profile.avatar].icon;
	bar.querySelector(".player-name").textContent = studentLabel();
	bar.querySelector(".player-level").textContent = "Level " + lv.level + " \u00B7 " + levelTitle(lv.level);
	bar.querySelector(".player-xp-fill").style.width = (lv.into / lv.need * 100).toFixed(1) + "%";
	var streak = currentStreak();
	var streakEl = bar.querySelector(".player-streak");
	streakEl.querySelector(".player-stat-value").textContent = streak;
	streakEl.classList.toggle("cold", streak === 0);
	var today = secondsToday();
	var goal = bar.querySelector(".player-goal");
	goalRingStyle(goal.querySelector(".goal-ring"), today);
	goal.querySelector(".player-stat-value").textContent = Math.min(profile.goal, Math.floor(today / 60)) + "/" + profile.goal;
	bar.setAttribute("aria-label", studentLabel() + ", level " + lv.level + ", " + streak + " day streak, " +
		Math.floor(today / 60) + " of " + profile.goal + " minutes today. Open your profile");
}

// Called by showPracticeMenu() once the cards are built
function onPracticeMenuShown(menu, page) {
	updatePlayerBar();
	markNextUp(menu, page);
}

// Called by loadPracticeInstrument(): remember the student's instrument,
// and award badges already earned before badges existed
function onPracticeLoaded() {
	if (!profile || currentStudent === null) return;
	if (profile.instrument !== practice.instrument) {
		profile.instrument = practice.instrument;
		saveProfile();
	}
	checkBadges(true);
}

function hubElement() {
	var hub = document.getElementById("practice-hub");
	hub.innerHTML = "";
	return hub;
}

function el(tag, className, text) {
	var e = document.createElement(tag);
	if (className) e.className = className;
	if (text !== undefined) e.textContent = text;
	return e;
}

// Who's practicing? from: "open" (Practice opened with no one chosen yet)
// or "profile" (Switch student)
function showSignIn(from) {
	clearTimeout(practiceAdvanceTimer);
	stopNote();
	if (practiceStartedMic && listenActive) stopListening();
	practiceStartedMic = false;
	practice.step = -1;
	practice.signinFrom = from || "open";
	setPracticeMode("signin");
	var back = document.getElementById("practice-close");
	var label = practice.signinFrom === "profile" ? "Back to your profile" : "Back to the app";
	back.setAttribute("aria-label", label);
	back.title = label;

	var hub = hubElement();
	var box = el("div", "signin");
	box.appendChild(el("div", "signin-icon", "\uD83C\uDFBA"));
	box.appendChild(el("h3", "signin-title", "Who\u2019s practicing?"));
	var form = el("form", "signin-form");
	var input = el("input", "signin-input");
	input.id = "student-id";
	input.type = "text";
	input.inputMode = "numeric";
	input.autocomplete = "off";
	input.spellcheck = false;
	input.maxLength = 16;
	input.placeholder = "Student ID";
	input.setAttribute("aria-label", "Student ID");
	form.appendChild(input);
	var go = practiceButton("Start", "primary", function() {});
	go.type = "submit";
	form.appendChild(go);
	form.onsubmit = function(event) {
		event.preventDefault();
		var id = normalizeStudentId(input.value);
		if (!id) {
			showToast("A student ID is 3 to 12 letters and numbers.");
			input.focus();
			return;
		}
		signInStudent(id);
	};
	box.appendChild(form);
	box.appendChild(el("p", "signin-note", "Your stars and levels are saved on this device only."));
	var guest = practiceButton("Practice as a guest", "secondary", function() { signInStudent(""); });
	guest.classList.add("signin-guest");
	box.appendChild(guest);
	hub.appendChild(box);
	input.focus();
}

// Switch to a student ("" = guest): their progress, and their instrument
// if this device has one saved for them
function signInStudent(id) {
	var from = practice.signinFrom;  // loadPracticeInstrument() starts practice afresh
	saveProfile();
	currentStudent = id;
	try { localStorage.setItem(STUDENT_STORAGE_KEY, id); } catch (e) {}
	profile = loadProfile();
	var select = document.getElementById("instrument");
	var saved = profile.instrument;
	if (saved && saved !== select.value) {
		var previous = select.value;
		select.value = saved;
		if (select.value === saved) {
			select.dispatchEvent(new Event("change"));
		} else {
			select.value = previous;  // not offered in this mode
		}
	}
	loadPracticeInstrument();
	// A student without a name yet is asked for one, to be greeted by
	if (id && !profile.name) {
		showNameStep(from);
		return;
	}
	finishSignIn();
}

// Signed in (and named): on to the menu, with a hello
function finishSignIn() {
	showPracticeMenu("main");
	if (currentStudent) showProgressPop("Hi, " + studentLabel() + "!", "goal");
	if (pendingSongImport) openSongImport();
}

// What's your name? Right after a new ID (from: how sign-in was reached),
// or "rename" from the profile's pencil
function showNameStep(from) {
	practice.step = -1;
	practice.signinFrom = from === "open" ? "open" : "profile";
	setPracticeMode("signin");
	var renaming = from === "rename";
	var back = document.getElementById("practice-close");
	var label = practice.signinFrom === "profile" ? "Back to your profile" : "Back to the practice menu";
	back.setAttribute("aria-label", label);
	back.title = label;

	var hub = hubElement();
	var box = el("div", "signin");
	box.appendChild(el("div", "signin-icon", "\uD83D\uDC4B"));
	box.appendChild(el("h3", "signin-title", "What\u2019s your name?"));
	var form = el("form", "signin-form");
	var input = el("input", "signin-input signin-name");
	input.id = "student-name";
	input.type = "text";
	input.autocomplete = "off";
	input.autocapitalize = "words";
	input.spellcheck = false;
	input.maxLength = STUDENT_NAME_MAX;
	input.placeholder = "First name";
	input.value = profile.name;
	input.setAttribute("aria-label", "First name");
	form.appendChild(input);
	var go = practiceButton(renaming ? "Save" : "Let\u2019s go!", "primary", function() {});
	go.type = "submit";
	form.appendChild(go);
	form.onsubmit = function(event) {
		event.preventDefault();
		var name = cleanStudentName(input.value);
		if (!name) {
			showToast("Type your first name.");
			input.focus();
			return;
		}
		profile.name = name;
		saveProfile();
		if (renaming) showProfile(); else finishSignIn();
	};
	box.appendChild(form);
	box.appendChild(el("p", "signin-note", "Student " + currentStudent));
	if (!renaming) {
		var skip = practiceButton("Skip", "secondary", finishSignIn);
		skip.classList.add("signin-guest");
		box.appendChild(skip);
	}
	hub.appendChild(box);
	input.focus();
}

function showProfile() {
	clearTimeout(practiceAdvanceTimer);
	stopNote();
	if (practiceStartedMic && listenActive) stopListening();
	practiceStartedMic = false;
	practice.step = -1;
	setPracticeMode("profile");
	saveProfile();
	renderProfile();
	document.getElementById("practice-view").scrollTop = 0;
}

function renderProfile() {
	var hub = hubElement();
	var lv = levelForXp(profile.xp);
	var view = el("div", "profile");

	// Avatar, name, level and XP
	var top = el("div", "profile-top");
	var avatar = el("button", "profile-avatar", AVATARS[profile.avatar].icon);
	avatar.setAttribute("aria-label", "Change your avatar");
	avatar.setAttribute("aria-expanded", practice.avatarPicker ? "true" : "false");
	avatar.onclick = function() {
		practice.avatarPicker = !practice.avatarPicker;
		renderProfile();
	};
	top.appendChild(avatar);
	var who = el("div", "profile-who");
	var nameRow = el("div", "profile-name-row");
	nameRow.appendChild(el("div", "profile-name", studentLabel()));
	if (currentStudent) {
		var rename = el("button", "profile-rename");
		rename.innerHTML = PENCIL_SVG;
		rename.setAttribute("aria-label", profile.name ? "Change your name" : "Add your name");
		rename.title = rename.getAttribute("aria-label");
		rename.onclick = function() { showNameStep("rename"); };
		nameRow.appendChild(rename);
	}
	who.appendChild(nameRow);
	if (currentStudent && profile.name) who.appendChild(el("div", "profile-id", "Student " + currentStudent));
	who.appendChild(el("div", "profile-level", "Level " + lv.level + " \u00B7 " + levelTitle(lv.level)));
	var xpBar = el("div", "profile-xp");
	var fill = el("div", "profile-xp-fill");
	fill.style.width = (lv.into / lv.need * 100).toFixed(1) + "%";
	xpBar.appendChild(fill);
	who.appendChild(xpBar);
	who.appendChild(el("div", "profile-xp-text", lv.into + " / " + lv.need + " XP to level " + (lv.level + 1)));
	top.appendChild(who);
	view.appendChild(top);

	if (practice.avatarPicker) {
		var picker = el("div", "avatar-picker");
		AVATARS.forEach(function(a, i) {
			var locked = a.level > lv.level;
			var b = el("button", "avatar-choice" + (i === profile.avatar ? " chosen" : ""));
			b.innerHTML = '<span class="avatar-icon"></span>';
			b.firstChild.textContent = a.icon;
			if (locked) b.appendChild(el("span", "avatar-lock", "Lv " + a.level));
			b.disabled = locked;
			b.setAttribute("aria-label", locked ? "Unlocks at level " + a.level : "Choose this avatar");
			b.setAttribute("aria-pressed", i === profile.avatar ? "true" : "false");
			b.onclick = function() {
				profile.avatar = i;
				practice.avatarPicker = false;
				saveProfile();
				renderProfile();
			};
			picker.appendChild(b);
		});
		view.appendChild(picker);
	}

	// Streak, today, total
	var stats = el("div", "profile-stats");
	var streak = currentStreak();
	var streakTile = el("div", "profile-stat streak" + (streak ? "" : " cold"));
	streakTile.appendChild(el("div", "profile-stat-icon", "\uD83D\uDD25"));
	streakTile.appendChild(el("div", "profile-stat-value", streak + (streak === 1 ? " day" : " days")));
	streakTile.appendChild(el("div", "profile-stat-label", profile.freezes
		? "\u2744\uFE0F \u00D7" + profile.freezes + " freeze" + (profile.freezes === 1 ? "" : "s") : "streak"));
	streakTile.title = "Days in a row you reached your goal. A streak freeze covers a missed day; you earn one every 7 days.";
	stats.appendChild(streakTile);
	var today = secondsToday();
	var todayTile = el("div", "profile-stat");
	var ring = el("div", "goal-ring big");
	goalRingStyle(ring, today);
	ring.appendChild(el("span", "goal-ring-text", Math.floor(today / 60)));
	todayTile.appendChild(ring);
	todayTile.appendChild(el("div", "profile-stat-value", "of " + profile.goal + " min"));
	todayTile.appendChild(el("div", "profile-stat-label", "today"));
	stats.appendChild(todayTile);
	var total = el("div", "profile-stat");
	total.appendChild(el("div", "profile-stat-icon", "\u23F1\uFE0F"));
	total.appendChild(el("div", "profile-stat-value", formatPracticeTime(totalSeconds())));
	total.appendChild(el("div", "profile-stat-label", "in all"));
	stats.appendChild(total);
	view.appendChild(stats);

	// The last 7 days
	var week = el("div", "profile-section");
	var weekSeconds = 0, weekDays = 0;
	var bars = el("div", "week-bars");
	var todayKey = dayKey(new Date());
	for (var i = 6; i >= 0; i--) {
		var d = addDays(todayKey, -i);
		var sec = profile.days[d] || 0;
		weekSeconds += sec;
		if (sec >= 60) weekDays++;
		var col = el("div", "week-day" + (i === 0 ? " today" : ""));
		var track = el("div", "week-track");
		var bar = el("div", "week-bar" + (sec >= profile.goal * 60 ? " met" : ""));
		bar.style.height = (Math.min(1, sec / (profile.goal * 60)) * 100).toFixed(1) + "%";
		track.appendChild(bar);
		col.appendChild(track);
		col.appendChild(el("div", "week-label", "SMTWTFS".charAt(dayDate(d).getDay())));
		col.title = Math.floor(sec / 60) + " min";
		bars.appendChild(col);
	}
	week.appendChild(el("h3", "profile-heading", "This week"));
	week.appendChild(bars);
	week.appendChild(el("div", "week-summary", formatPracticeTime(weekSeconds) + " on " + weekDays +
		(weekDays === 1 ? " day" : " days")));
	var goals = el("div", "goal-picker");
	goals.appendChild(el("span", "goal-picker-label", "Daily goal"));
	DAILY_GOAL_OPTIONS.forEach(function(min) {
		var b = el("button", "goal-option", min + " min");
		b.setAttribute("aria-pressed", min === profile.goal ? "true" : "false");
		b.onclick = function() { setDailyGoal(min); };
		goals.appendChild(b);
	});
	week.appendChild(goals);
	view.appendChild(week);

	// The path
	var nodes = learningPath();
	var next = nextPathNode(nodes);
	var path = el("div", "profile-section");
	var done = nodes.filter(function(n) { return n.done; }).length;
	path.appendChild(el("h3", "profile-heading", "Your path \u00B7 " + done + " of " + nodes.length));
	var list = el("ol", "path-list");
	nodes.forEach(function(node) {
		var li = el("li", "path-node" + (node.done ? " done" : "") + (node === next ? " current" : ""));
		var b = el("button", "path-button");
		b.appendChild(el("span", "path-dot", node.done ? "\u2713" : ""));
		b.appendChild(el("span", "path-title", node.title));
		if (node === next) b.appendChild(el("span", "path-go", "Go!"));
		b.onclick = function() { startPathNode(node); };
		li.appendChild(b);
		list.appendChild(li);
	});
	path.appendChild(list);
	view.appendChild(path);

	// Badges
	var shown = BADGES.filter(function(b) { return profile.badges[b.id] || !b.available || b.available(); });
	var earnedCount = shown.filter(function(b) { return profile.badges[b.id]; }).length;
	var badges = el("div", "profile-section");
	badges.appendChild(el("h3", "profile-heading", "Badges \u00B7 " + earnedCount + " of " + shown.length));
	var grid = el("div", "badge-grid");
	shown.forEach(function(b) {
		var got = !!profile.badges[b.id];
		var tile = el("div", "badge" + (got ? " earned" : ""));
		tile.appendChild(el("div", "badge-icon", b.icon));
		tile.appendChild(el("div", "badge-name", b.name));
		tile.appendChild(el("div", "badge-how", b.how));
		tile.setAttribute("aria-label", b.name + ": " + b.how + (got ? " (earned)" : " (not yet)"));
		grid.appendChild(tile);
	});
	badges.appendChild(grid);
	view.appendChild(badges);

	var actions = el("div", "practice-actions");
	actions.appendChild(practiceButton(currentStudent ? "Switch student" : "Sign in with student ID", "secondary",
		function() { showSignIn("profile"); }));
	view.appendChild(actions);
	hub.appendChild(view);
}

function setDailyGoal(min) {
	profile.goal = min;
	var today = dayKey(new Date());
	if (secondsToday() >= min * 60 && profile.lastGoalDay !== today) {
		reachDailyGoal(today);
	}
	saveProfile();
	renderProfile();
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

profile = loadProfile();
setInterval(practiceTick, 1000);

(function() {
	var view = document.getElementById("practice-view");
	view.addEventListener("pointerdown", markPracticeActive);
	view.addEventListener("keydown", markPracticeActive);
	document.addEventListener("visibilitychange", function() {
		if (document.hidden) saveProfile();
	});
	window.addEventListener("pagehide", saveProfile);
	// The student's instrument comes back when they sign in again
	document.getElementById("instrument").addEventListener("change", function(event) {
		if (profile && currentStudent && event.target.value) {
			profile.instrument = event.target.value;
			saveProfile();
		}
	});
	document.addEventListener("keydown", function(event) {
		var card = document.getElementById("level-up");
		if (event.key === "Escape" && card && !card.hidden) {
			event.stopImmediatePropagation();
			closeLevelUp();
		}
	}, true);
})();

// Installable and offline: the service worker keeps a copy of the app
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
	window.addEventListener("load", function() {
		navigator.serviceWorker.register("sw.js").catch(function() {});
	});
}
