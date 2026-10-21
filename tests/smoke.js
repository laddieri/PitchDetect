/*
 * Smoke test: drives the real app in Chromium with a WAV file as the
 * microphone and checks the paths a broken change would most likely hit.
 *
 *   npm install --no-save playwright   # once, if it isn't installed
 *   node tests/smoke.js
 *
 * (Or with a global Playwright: NODE_PATH=$(npm root -g) node tests/smoke.js.
 * Set CHROMIUM=/path/to/chrome to use a browser Playwright didn't download.)
 *
 * It serves the repo on a local port itself; nothing else is needed.
 * Exits non-zero, listing what failed, if any check fails.
 */
"use strict";

var http = require("http");
var fs = require("fs");
var os = require("os");
var path = require("path");
var chromium = require("playwright").chromium;

var ROOT = path.resolve(__dirname, "..");
var TYPES = {
	".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
	".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png",
	".gif": "image/gif", ".ico": "image/x-icon", ".jpg": "image/jpeg"
};

var failures = [];
function check(ok, what) {
	console.log((ok ? "  ok   " : "  FAIL ") + what);
	if (!ok) failures.push(what);
}

// A 16-bit mono WAV of a sine tone
function writeTone(file, freq, seconds) {
	var rate = 44100, n = Math.round(rate * seconds);
	var buf = Buffer.alloc(44 + n * 2);
	buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8);
	buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
	buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
	buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
	for (var i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * freq * i / rate) * 12000), 44 + i * 2);
	fs.writeFileSync(file, buf);
}

var slowNetwork = false;  // answers take 10 s, like a crowded school Wi-Fi

function serve() {
	var server = http.createServer(function(req, res) {
		if (slowNetwork) setTimeout(function() { answer(req, res); }, 10000);
		else answer(req, res);
	});
	function answer(req, res) {
		var url = decodeURIComponent(req.url.split("?")[0]);
		var file = path.join(ROOT, url === "/" ? "index.html" : url);
		if (file.indexOf(ROOT) !== 0) { res.writeHead(403); res.end(); return; }
		fs.readFile(file, function(err, data) {
			if (err) { res.writeHead(404); res.end(); return; }
			res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
			res.end(data);
		});
	}
	return new Promise(function(resolve) {
		server.listen(0, "127.0.0.1", function() { resolve(server); });
	});
}

// A page that records uncaught errors and console errors (a font or other
// network failure isn't the app's fault, so those are left out)
async function newPage(context, errors) {
	var page = await context.newPage();
	page.on("pageerror", function(e) { errors.push(e.message); });
	page.on("console", function(msg) {
		if (msg.type() === "error" && !/Failed to load resource|net::ERR/.test(msg.text())) errors.push(msg.text());
	});
	return page;
}

async function signIn(page, name, instrumentLabel) {
	await page.click("#practiceButton");
	await page.fill("#student-name", name);
	await page.press("#student-name", "Enter");
	await page.click(".instrument-choice >> text=" + instrumentLabel);
	await page.waitForSelector('#practice-view[data-mode="menu"]');
}

async function run() {
	var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pitchdetect-smoke-"));
	var wav = path.join(tmp, "a440.wav");
	writeTone(wav, 440, 6);
	var server = await serve();
	var base = "http://127.0.0.1:" + server.address().port + "/";
	var browser = await chromium.launch({
		executablePath: process.env.CHROMIUM || undefined,
		args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
			"--use-file-for-fake-audio-capture=" + wav, "--autoplay-policy=no-user-gesture-required"]
	});

	try {
		// --- Loads cleanly on desktop and phone ---
		console.log("Layout");
		for (var size of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
			var errors = [];
			var context = await browser.newContext({ viewport: size, serviceWorkers: "block" });
			var page = await newPage(context, errors);
			await page.goto(base);
			await page.waitForSelector("#staff-output svg");
			var overflow = await page.evaluate(function() {
				return document.documentElement.scrollWidth > window.innerWidth ||
					document.documentElement.scrollHeight > window.innerHeight;
			});
			check(!overflow, size.width + "px: no page scroll");
			check(errors.length === 0, size.width + "px: no errors" + (errors.length ? " (" + errors.join("; ") + ")" : ""));
			await context.close();
		}

		// --- Listen names a 440 Hz tone ---
		console.log("Listen");
		var errors = [];
		var context = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ["microphone"], serviceWorkers: "block" });
		var page = await newPage(context, errors);
		await page.goto(base);
		await page.click("#listenButton");
		var heard = await page.waitForFunction(function() {
			var t = document.getElementById("note-display").textContent.trim();
			return /^A/.test(t) ? t : false;
		}, null, { timeout: 8000 }).then(function(h) { return h.jsonValue(); }, function() { return null; });
		check(heard !== null, "440 Hz reads as A (got \"" + (await page.textContent("#note-display")).trim() + "\")");
		await page.click("#listenButton");
		check(errors.length === 0, "no errors" + (errors.length ? " (" + errors.join("; ") + ")" : ""));
		await context.close();

		// --- Practice sign-in and saved progress ---
		console.log("Practice progress");
		errors = [];
		context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" });
		page = await newPage(context, errors);
		await page.goto(base);
		await signIn(page, "Smoke", "Trumpet");
		var map = await page.evaluate(function() {
			return { page: document.getElementById("practice-view").getAttribute("data-menu-page"),
				stops: document.querySelectorAll(".world-stop").length - PRACTICE_UNITS.length,
				here: !!document.querySelector('.world-row[data-state="current"] .world-avatar') };
		});
		check(map.page === "map" && map.stops === 1 && map.here,
			"Practice opens on the map of units, the student on theirs");
		await page.click(".world-continue");
		await page.waitForFunction(function() { return practice.mode !== "menu"; });
		await page.goBack();
		await page.waitForFunction(function() { return practice.mode === "menu"; });
		var unitPage = await page.getAttribute("#practice-view", "data-menu-page");
		await page.goBack();
		await page.waitForFunction(function() { return practice.menuPage === "map"; });
		check(unitPage === "unit1", "back from the next step goes to its unit, then the map (got " + unitPage + ")");
		// A unit's stop shows its summary first; back closes it, its button opens the unit
		await page.evaluate(function() { practice.lessons.first5.stars[0] = 3; });
		await page.click('.world-stop[data-page="unit2"]');
		var summary = await page.evaluate(function() {
			var card = document.getElementById("unit-summary");
			return { shown: !card.hidden, page: practice.menuPage,
				passed: card.querySelector(".passed .unit-summary-of").textContent,
				stars: card.querySelector(".stars .unit-summary-value").textContent + " " +
					card.querySelector(".stars .unit-summary-of").textContent };
		});
		check(summary.shown && summary.page === "map" && summary.passed === "of 6" && summary.stars === "3 of 39",
			"a unit's stop shows its activities passed and stars (got " + summary.passed + ", " + summary.stars + ")");
		await page.goBack();
		await page.waitForFunction(function() { return document.getElementById("unit-summary").hidden; });
		await page.click('.world-stop[data-page="unit2"]');
		await page.click(".unit-summary-go");
		var opened = await page.getAttribute("#practice-view", "data-menu-page");
		await page.goBack();
		await page.waitForFunction(function() { return practice.menuPage === "map"; });
		check(opened === "unit2" && await page.isHidden("#unit-summary"),
			"back closes the summary, and its button opens the unit, then back to the map");
		await page.evaluate(function() { recordProgress(25); saveProfile(); });
		var saved = await page.evaluate(function() {
			var id = localStorage.getItem("pitchdetect-student");
			return { id: id, profile: JSON.parse(localStorage.getItem("pitchdetect-profile@" + id) || "null"),
				version: localStorage.getItem("pitchdetect-data-version") };
		});
		check(saved.id && saved.profile && saved.profile.name === "Smoke", "the student's profile is saved under their ID");
		check(saved.profile && saved.profile.instrument === "trumpet", "the student's instrument is saved");
		check(saved.profile && saved.profile.xp >= 25, "XP is saved");
		check(saved.version === "1", "the data version is recorded");
		await page.reload();
		await page.click("#practiceButton");
		await page.waitForSelector('#practice-view[data-mode="menu"]');
		var after = await page.evaluate(function() { return { student: currentStudent, xp: profile.xp }; });
		check(after.student === saved.id && after.xp === saved.profile.xp, "still signed in, with the same XP, after a reload");

		// Songs have a piano part, and Play along counts in, then plays it
		var chords = await page.evaluate(function() {
			playThroughSong("mary");
			return songAccompaniment(practice.song.song, practice.song.events).filter(function(h) { return h.midis.length > 2; }).length;
		});
		check(chords > 0, "a song has piano chords");
		await page.click("#song-along");
		// (once the mic is on: the count-in measures the piano at the mic)
		var counted = await page.waitForFunction(function() {
			return /^\d$/.test(document.getElementById("practice-feedback").textContent) && listenActive
				&& document.getElementById("practice-feedback").textContent;
		}).then(function(h) { return h.jsonValue(); });
		await page.waitForTimeout(3200);
		var along = await page.evaluate(function() {
			return { piano: accompNodes.length, label: document.getElementById("song-along").textContent };
		});
		check(counted === "1" && along.piano > 0 && /Stop/.test(along.label), "Play along counts in and plays the piano");
		// On a desktop the chart goes beside the music, not under it
		var side = await page.evaluate(function() {
			var staff = document.querySelector(".practice-staff").getBoundingClientRect();
			var chart = document.getElementById("song-fingering").getBoundingClientRect();
			return { beside: chart.left >= staff.right, h: Math.round(staff.height) };
		});
		check(side.beside && side.h >= 300, "on a desktop the song's chart goes beside the staff (staff " + side.h + "px tall)");
		await page.click("#song-along");
		check(await page.evaluate(function() { return songPlayTimer === null && accompNodes.length === 0; }), "Play along stops");

		// A song doesn't listen until asked; a tapped note shows its fingering
		var quiet = await page.evaluate(function() {
			playThroughSong("mary");
			return listenActive;
		});
		await page.click("#song-listen");
		await page.waitForFunction(function() { return listenActive; }, null, { timeout: 5000 }).catch(function() {});
		var listening = await page.evaluate(function() {
			return { on: listenActive, label: document.getElementById("song-listen").textContent };
		});
		check(!quiet && listening.on && /Stop and score/.test(listening.label),
			"a song listens only after Listen to me");
		await page.click("#song-listen");
		function noteSpot() {
			var s = practice.song, i = s.notes[2].event;
			var line = Object.keys(s.layouts).find(function(l) { return s.layouts[l].xs[i] !== undefined; });
			var r = s.layouts[line], pt = r.svg.createSVGPoint();
			pt.x = r.xs[i];
			pt.y = r.stave.getYForLine(2);
			var p = pt.matrixTransform(r.svg.getScreenCTM());
			return { x: p.x, y: p.y, event: i, mic: listenActive };
		}
		var spot = await page.evaluate(noteSpot);
		await page.mouse.click(spot.x, spot.y);
		var tapped = await page.evaluate(function() {
			var wrap = document.getElementById("song-fingering");
			return { tapped: practice.song.tapped, chart: !!(wrap && wrap.querySelector(".practice-fingering:not([hidden])")),
				name: wrap ? wrap.querySelector(".song-fingering-name").textContent : "" };
		});
		check(!spot.mic && tapped.tapped === spot.event && tapped.chart && tapped.name,
			"Stop and score turns the mic off, and a tapped note shows its fingering (" + tapped.name + ")");
		// (On a desktop the chart goes beside the staff, which moves it)
		spot = await page.evaluate(noteSpot);
		await page.mouse.click(spot.x, spot.y);
		check(await page.evaluate(function() { return !document.getElementById("song-fingering") && practice.song.tapped === null; }),
			"tapping the note again puts its fingering away");

		// Play along scores each note in time, over the piano: a note no
		// louder than the piano doesn't count, and passing a speed opens the
		// next. The mic is replaced by frames playing each note as it comes
		// (skip: a note played only as loud as the piano).
		await page.evaluate(function() {
			window.realPracticeListen = updatePracticeListen;
			updatePracticeListen = function() {};
			ALONG_SPEEDS[1].tempo = 240;  // quick, for the test
			window.alongSim = { skip: -1 };
			window.alongSimTimer = setInterval(function() {
				var s = practice.song, a = s && s.along;
				if (!a || a.done) return;
				var now = performance.now();
				if (!a.times.length) {
					updateFollowListen(now, null, 0.01);  // the count-in click
					return;
				}
				var i = a.times.length - 1, e = s.events[i];
				var j = s.notes.findIndex(function(n) { return n.event === i; });
				var freq = e && e.midi !== null ? frequencyFromNoteNumber(e.midi - getTransposition()) : null;
				// A short tongued gap at the start of each note (at least one
				// frame, should the timer run late)
				var level = !freq || a.ended || now - a.times[i] < 40 || alongSim.last !== i ? 0.001 : j === alongSim.skip ? 0.015 : 0.2;
				alongSim.last = i;
				updateFollowListen(now, freq, level);
			}, 16);
			playThroughSong("auclair");
			songSpeed = "walk";
			alongSim.skip = 2;
			playAlong();
		});
		await page.waitForFunction(function() { return practice.song.done; }, null, { timeout: 15000 });
		var missed = await page.evaluate(function() {
			return { results: practice.song.results.slice(), text: document.getElementById("practice-feedback").textContent };
		});
		check(missed.results[2] === "missed" && missed.results.filter(function(r) { return r === "right"; }).length === missed.results.length - 1,
			"Play along scores notes in time, and not one as quiet as the piano");
		await page.evaluate(function() {
			alongSim.skip = -1;
			startAlong("walk");
		});
		await page.waitForFunction(function() { return practice.song.done; }, null, { timeout: 15000 });
		var passed = await page.evaluate(function() {
			var bunny = document.querySelectorAll("#practice-steps .speed-choice")[2];
			return { text: document.getElementById("practice-feedback").textContent, bunnyOpen: !bunny.disabled,
				best: practice.songSpeedBest.auclair, total: practice.song.notes.length };
		});
		check(/Perfect/.test(passed.text) && passed.bunnyOpen && passed.best && passed.best.walk === passed.total,
			"a perfect Play along is saved and opens the next speed");
		await page.evaluate(function() {
			clearInterval(alongSimTimer);
			updatePracticeListen = realPracticeListen;
			ALONG_SPEEDS[1].tempo = 80;
			closeLevelUp();  // the runs' XP may have leveled up
		});

		// Following a long song, the next line shows before it's reached
		await page.evaluate(function() {
			playThroughSong("joyscale");
			drawSongEvent(practice.song.events.findIndex(function(e) { return e.measure === SONG_MEASURES_PER_LINE * 2; }));
		});
		await page.waitForTimeout(800);
		var ahead = await page.evaluate(function() {
			var out = document.getElementById("practice-staff-output");
			var next = songLineInk(out.querySelector(".song-line.current").nextElementSibling);
			return out.scrollTop > 0 && next.bottom <= out.scrollTop + out.clientHeight;
		});
		check(ahead, "a song scrolls to show the next line ahead");

		// A shared song keeps its triplets: three notes in a beat, drawn with a 3
		var triplet = await page.evaluate(function() {
			var t = function(s) { return { s: s, a: 0, d: "8", dot: 0, t: 1 }; };
			var notes = [{ s: 30, a: 0, d: "q", dot: 0 }, t(29), t(30), t(29), { s: 28, a: 0, d: "q", dot: 0 }];
			var shared = decodeSongShare(encodeSongShare({ title: "Triplets", key: "C", time: "3/4", notes: notes }, "trumpet"));
			var short = decodeSongShare(encodeSongShare({ title: "Short", key: "C", time: "3/4", notes: notes.slice(0, 3) }, "trumpet"));
			var song = shared.song;
			song.custom = true;
			var events = customSongEvents(song);
			var drawn = 0, draw = Vex.Flow.Tuplet.prototype.draw;
			Vex.Flow.Tuplet.prototype.draw = function() { drawn++; return draw.apply(this, arguments); };
			var out = document.createElement("div");
			document.body.appendChild(out);
			renderSongLine(out, song, events, 0, 1, {}, function() { return null; });
			out.remove();
			Vex.Flow.Tuplet.prototype.draw = draw;
			return { measures: events[events.length - 1].measure + 1, drawn: drawn, short: short };
		});
		check(triplet.measures === 1 && triplet.drawn === 1 && triplet.short === null,
			"a shared triplet fits one beat and is drawn with its 3; a short triplet is refused");

		// Tied notes across a bar line are one sound: one note to play, held
		// for both, drawn with a tie; a tie to another pitch is refused
		var tie = await page.evaluate(function() {
			var n = function(s, d, tie) { return { s: s, a: 0, d: d, dot: 0, tie: tie ? 1 : 0 }; };
			var notes = [n(28, "h"), n(29, "h", true), n(29, "q"), n(30, "q"), n(28, "h")];
			var shared = decodeSongShare(encodeSongShare({ title: "Ties", key: "C", time: "4/4", notes: notes }, "trumpet"));
			var wrong = decodeSongShare(encodeSongShare({ title: "Wrong", key: "C", time: "4/4", notes: [n(28, "h", true), n(29, "h")] }, "trumpet"));
			var song = shared.song;
			song.custom = true;
			var events = customSongEvents(song);
			var drawn = 0, draw = Vex.Flow.StaveTie.prototype.draw;
			Vex.Flow.StaveTie.prototype.draw = function() { drawn++; return draw.apply(this, arguments); };
			var out = document.createElement("div");
			document.body.appendChild(out);
			renderSongLine(out, song, events, 0, 2, {}, function() { return null; });
			out.remove();
			Vex.Flow.StaveTie.prototype.draw = draw;
			return { notes: songNotes(song, events).length, held: tiedBeats(events, 1), drawn: drawn, wrong: wrong };
		});
		check(tie.notes === 4 && tie.held === 3 && tie.drawn === 1 && tie.wrong === null,
			"tied notes are one sound held for both and drawn with a tie; a tie to another note is refused");

		// Slurred notes play as one tone gliding between them, drawn with a
		// slur; a slur left open is refused
		var slur = await page.evaluate(function() {
			var n = function(s, mark) { var note = { s: s, a: 0, d: "q", dot: 0 }; if (mark) note[mark] = 1; return note; };
			var notes = [n(28, "so"), n(29), n(30, "sc"), n(31)];
			var shared = decodeSongShare(encodeSongShare({ title: "Slur", key: "C", time: "4/4", notes: notes }, "trumpet"));
			var open = decodeSongShare(encodeSongShare({ title: "Open", key: "C", time: "4/4", notes: [n(28, "so"), n(29)] }, "trumpet"));
			var song = shared.song;
			song.custom = true;
			var events = customSongEvents(song);
			var drawn = 0, draw = Vex.Flow.Curve.prototype.draw;
			Vex.Flow.Curve.prototype.draw = function() { drawn++; return draw.apply(this, arguments); };
			var out = document.createElement("div");
			document.body.appendChild(out);
			renderSongLine(out, song, events, 0, 1, {}, function() { return null; });
			out.remove();
			Vex.Flow.Curve.prototype.draw = draw;
			return { legato: events.map(function(e) { return e.legato ? 1 : 0; }).join(""), run: soundBeats(events, 0), drawn: drawn, open: open };
		});
		check(slur.legato === "0110" && slur.run === 3 && slur.drawn === 1 && slur.open === null,
			"slurred notes sound as one tone and are drawn with a slur; an open slur is refused");

		// A good result leads straight on to the next step of the path
		await page.evaluate(function() {
			practice.firstSoundsBest = 3;
			practice.lessons.first3.stars = [3, 3, 3];
			startDrill("names3");
			practice.challenge.score = DRILL_STAR_GOAL;
			finishDrill();
		});
		var nextStep = await page.textContent(".path-next").catch(function() { return ""; });
		await page.click(".path-next");
		var onward = await page.evaluate(function() { return practice.mode + " " + practice.drillKind; });
		check(/^Next: Finger/.test(nextStep) && onward === "drill fingerings3",
			"a drill's result goes on to the next step (got \"" + nextStep + "\", " + onward + ")");

		// A save that fails says so instead of losing progress silently
		var toast = await page.evaluate(function() {
			var setItem = Storage.prototype.setItem;
			Storage.prototype.setItem = function() { throw new DOMException("full", "QuotaExceededError"); };
			try { saveProfile(); } finally { Storage.prototype.setItem = setItem; }
			var t = document.getElementById("toast");
			return t.classList.contains("visible") ? t.textContent : "";
		});
		check(/couldn’t be saved/.test(toast), "a failed save shows a warning");
		check(errors.length === 0, "no errors" + (errors.length ? " (" + errors.join("; ") + ")" : ""));
		await context.close();

		// --- The lesson's Play step draws the pitch on the staff ---
		console.log("Pitch trace");
		errors = [];
		context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["microphone"], serviceWorkers: "block" });
		page = await newPage(context, errors);
		await page.goto(base);
		await signIn(page, "Trace", "Trumpet");
		await page.evaluate(function() { startLesson("first5"); startPracticeNote(0); goToPracticeStep(3); });
		// 440 Hz is written B4 on trumpet: well above the lesson's first note, C4
		var traced = await page.waitForFunction(function() {
			var line = document.querySelector('.pitch-trace-line[data-state="off"]');
			var dot = document.querySelector(".pitch-trace-dot");
			if (!line || !line.getAttribute("d") || !dot.getAttribute("d")) return false;
			return dot.getBBox().y < pitchTrace.y - 20;
		}, null, { timeout: 8000 }).then(function() { return true; }, function() { return false; });
		check(traced, "a wrong note is traced above the target");
		var ladder = await page.evaluate(function() {
			return Array.prototype.map.call(document.querySelectorAll(".pitch-ladder-label"), function(l) {
				return (l.hasAttribute("data-target") ? "*" : "") + l.textContent;
			}).join(" ");
		});
		// Open on trumpet: C, G, C, E, G, the lesson's C the target
		check(ladder === "G E C G *C", "trumpet's partial ladder shows the open notes (got \"" + ladder + "\")");
		check(errors.length === 0, "no errors" + (errors.length ? " (" + errors.join("; ") + ")" : ""));
		await context.close();

		// --- The chromatic scale shows chromatic fingerings ---
		console.log("Chromatic scale");
		errors = [];
		context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
		page = await newPage(context, errors);
		await page.goto(base);
		await signIn(page, "Flutey", "Flute");
		var flute = await page.evaluate(function() {
			startPracticeActivity("scaleChromatic");
			startPracticeNote(0);
			goToPracticeStep(1);
			var lesson = currentLesson().notes.length;
			var bFlat = document.querySelector("#practice-body img.fingering-image").getAttribute("src");
			startPracticeActivity("scalerunChromatic");
			return { lesson: lesson, run: practice.challenge.seq.length, bFlat: bFlat };
		});
		check(flute.lesson === 13 && flute.run === 25, "the chromatic lesson has 13 notes and its run 25 (got " + flute.lesson + ", " + flute.run + ")");
		check(/70-1-and-1\.png$/.test(flute.bFlat), "flute's chromatic B♭ is 1 and 1 (got " + flute.bFlat + ")");
		await context.close();
		context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
		page = await newPage(context, errors);
		await page.goto(base);
		await signIn(page, "Clary", "Clarinet");
		var fSharp = await page.evaluate(function() {
			startPracticeActivity("scaleChromatic");
			startPracticeNote(6);
			goToPracticeStep(1);
			return practiceNoteName(practice.target) + " " + document.querySelector("#practice-body .clarinet-caption").textContent;
		});
		check(fSharp === "F♯ Side keys", "clarinet's chromatic F♯ takes the side keys (got \"" + fSharp + "\")");
		check(errors.length === 0, "no errors" + (errors.length ? " (" + errors.join("; ") + ")" : ""));
		await context.close();

		// --- iPhone Safari is told to add the app to the Home Screen ---
		console.log("iPhone");
		errors = [];
		context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block",
			userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
		page = await newPage(context, errors);
		await page.goto(base);
		await signIn(page, "Phone", "Flute");
		var hint = await page.evaluate(function() { return document.getElementById("toast").textContent; });
		check(/Add to Home Screen/.test(hint), "the Home Screen hint shows");
		var again = await page.evaluate(function() {
			document.getElementById("toast").textContent = "";
			maybeShowInstallHint();
			return document.getElementById("toast").textContent;
		});
		check(again === "", "the hint isn't repeated the same week");
		check(errors.length === 0, "no errors" + (errors.length ? " (" + errors.join("; ") + ")" : ""));
		await context.close();

		// --- Offline: the service worker keeps the app and the charts ---
		console.log("Offline");
		errors = [];
		context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
		page = await newPage(context, errors);
		await page.goto(base);
		await page.evaluate(function() { return navigator.serviceWorker.ready; });
		await page.reload();  // now under the service worker
		await page.selectOption("#instrument", "flute");
		var expected = await page.evaluate(function() { return fingeringImagePaths("flute").length; });
		var cached = await page.waitForFunction(async function(n) {
			var paths = fingeringImagePaths("flute");
			var hits = await Promise.all(paths.map(function(p) { return caches.match(p); }));
			return hits.filter(Boolean).length === n;
		}, expected, { timeout: 20000, polling: 500 }).then(function() { return true; }, function() { return false; });
		check(cached, "all " + expected + " flute charts are kept for offline");
		var missing = await page.evaluate(async function() {
			var all = Object.keys(imageFingeringMap).reduce(function(list, inst) {
				return list.concat(fingeringImagePaths(inst));
			}, []);
			var bad = [];
			for (var p of all) {
				var r = await fetch(p, { method: "HEAD", cache: "no-store" });
				if (!r.ok) bad.push(p);
			}
			return bad;
		});
		check(missing.length === 0, "every chart in imageFingeringMap's ranges exists" + (missing.length ? " (missing " + missing.join(", ") + ")" : ""));
		slowNetwork = true;
		var start = Date.now();
		await page.reload();
		var quick = await page.waitForSelector("#staff-output svg", { timeout: 8000 }).then(function() { return true; }, function() { return false; });
		slowNetwork = false;
		check(quick, "on a slow network, the saved copy loads (" + Math.round((Date.now() - start) / 100) / 10 + " s)");
		await context.setOffline(true);
		await page.reload();
		var works = await page.waitForSelector("#staff-output svg", { timeout: 8000 }).then(function() { return true; }, function() { return false; });
		check(works, "the app loads offline");
		check(errors.length === 0, "no errors" + (errors.length ? " (" + errors.join("; ") + ")" : ""));
		await context.close();
	} finally {
		await browser.close();
		server.close();
		fs.rmSync(tmp, { recursive: true, force: true });
	}

	if (failures.length) {
		console.log("\n" + failures.length + " failed");
		process.exit(1);
	}
	console.log("\nAll passed");
}

run().catch(function(e) {
	console.error(e);
	process.exit(1);
});
