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

		// --- A song link in a fresh browser ---
		// No instrument shows (not the sharer's) until the student says what
		// they play; then the song opens for theirs
		console.log("Song link");
		errors = [];
		context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" });
		page = await newPage(context, errors);
		var linkSong = Buffer.from(JSON.stringify({ v: 1, t: "Link", i: "euphonium", k: "C", m: "4/4", n: "wC3 wD3" })).toString("base64url");
		await page.goto(base + "#song=" + linkSong);
		await page.waitForSelector('#practice-view[data-mode="signin"]');
		var blank = await page.evaluate(function() {
			return document.getElementById("practice-instrument").textContent.trim() + "|" + document.getElementById("instrument").value;
		});
		await page.fill("#student-name", "Link");
		await page.press("#student-name", "Enter");
		await page.click(".instrument-choice >> text=Trumpet");
		await page.waitForSelector('#practice-view[data-mode="song"]');
		var opened = await page.evaluate(function() { return practice.instrument + " " + practice.song.song.title; });
		check(blank === "|" && opened === "trumpet Link",
			"a song link shows no instrument until the student picks one, then opens for theirs (got \"" + blank + "\", " + opened + ")");
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
		// The header's Songs button lists every song, Beginner included; back returns to the map
		await page.click("#practice-songs");
		var songList = await page.evaluate(function() {
			return { mode: practice.mode, levels: document.querySelectorAll("#practice-body .song-level").length, all: SONG_LEVELS.length };
		});
		await page.goBack();
		await page.waitForFunction(function() { return practice.menuPage === "map" && practice.mode === "menu"; });
		check(songList.mode === "songs" && songList.levels === songList.all,
			"the header's Songs button shows every level of songs (got " + songList.levels + "), and back returns to the map");
		// From a unit, the header's song list's back arrow goes to the map
		await page.evaluate(function() { showPracticeMenu("unit2"); });
		await page.click("#practice-songs");
		await page.click("#practice-close");
		await page.waitForFunction(function() { return practice.mode === "menu"; });
		var songsBack = await page.evaluate(function() { return practice.menuPage; });
		check(songsBack === "map", "the back arrow from the header's song list goes to the map (got " + songsBack + ")");
		// Breadcrumbs: none on the map; a song shows Map > its unit > its list > the
		// song, and the unit's crumb goes straight there (back then reaches the map)
		var noCrumbs = await page.isHidden("#practice-crumbs");
		await page.evaluate(function() { showPracticeMenu("unit2"); });
		await page.click('.practice-choice[data-activity="songs5"]');
		await page.click('#practice-body .song-choice:not(.song-level):not(.song-new)');
		await page.waitForFunction(function() { return practice.mode === "song"; });
		var crumbs = await page.$$eval("#practice-crumbs li", function(items) {
			return items.map(function(li) { return li.textContent; }).join(" > ");
		});
		await page.click("#practice-crumbs li:nth-child(2) button");
		var crumbPage = await page.evaluate(function() { return practice.mode + " " + practice.menuPage; });
		await page.goBack();
		await page.waitForFunction(function() { return practice.menuPage === "map"; });
		check(noCrumbs && /^Map > Unit 2 > Play 5-note songs > ./.test(crumbs) && crumbPage === "menu unit2",
			"breadcrumbs show where a song is and lead back to its unit (got " + crumbs + ", " + crumbPage + ")");
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
		// Play it starts Play along at a speed picked in the settings
		await page.evaluate(function() { songSpeed = "walk"; updateSpeedPicker(); });
		await page.click("#song-listen");
		// (once the mic is on: the count-in measures the piano at the mic)
		var counted = await page.waitForFunction(function() {
			return /^\d$/.test(document.getElementById("practice-feedback").textContent) && listenActive
				&& document.getElementById("practice-feedback").textContent;
		}).then(function(h) { return h.jsonValue(); });
		await page.waitForTimeout(3200);
		var along = await page.evaluate(function() {
			return { piano: accompNodes.length, label: document.getElementById("song-listen").textContent };
		});
		check(counted === "1" && along.piano > 0 && /Stop/.test(along.label), "Play along counts in and plays the piano");
		// On a desktop the chart goes beside the music, not under it
		var side = await page.evaluate(function() {
			var staff = document.querySelector(".practice-staff").getBoundingClientRect();
			var chart = document.getElementById("song-fingering").getBoundingClientRect();
			return { beside: chart.left >= staff.right, h: Math.round(staff.height) };
		});
		check(side.beside && side.h >= 300, "on a desktop the song's chart goes beside the staff (staff " + side.h + "px tall)");
		await page.click("#song-listen");
		check(await page.evaluate(function() { return songPlayTimer === null && accompNodes.length === 0; }), "Play along stops");

		// A song doesn't listen until asked; a tapped note shows its fingering
		var quiet = await page.evaluate(function() {
			songSpeed = "mine";
			playThroughSong("mary");
			return listenActive;
		});
		var buttons = await page.evaluate(function() {
			return Array.prototype.map.call(document.querySelectorAll("#practice-body .practice-actions > *"), function(b) { return b.id; }).join();
		});
		check(buttons === "song-hear,song-listen", "Play it through has just Hear it and Play it (got " + buttons + ")");
		await page.click("#song-listen");
		await page.waitForFunction(function() { return listenActive; }, null, { timeout: 5000 }).catch(function() {});
		var listening = await page.evaluate(function() {
			return { on: listenActive, label: document.getElementById("song-listen").textContent };
		});
		check(!quiet && listening.on && /Stop and score/.test(listening.label),
			"a song listens only after Play it");
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
		// Before a run, a tapped note is where Hear it and Play it start
		await page.evaluate(function() { playThroughSong("mary"); });
		spot = await page.evaluate(noteSpot);
		await page.mouse.click(spot.x, spot.y);
		var fromNote = await page.evaluate(async function() {
			var real = playSongEvents, first = null;
			playSongEvents = function(events) { first = events[0]; };
			document.getElementById("song-hear").click();
			playSongEvents = real;
			var s = practice.song, heard = first === s.events[s.notes[2].event];
			startFollow();
			var r = { heard: heard, runFrom: s.runFrom, start: songStartNote(s) };
			finishFollow();
			return r;
		});
		check(fromNote.heard && fromNote.start === 2 && fromNote.runFrom === 2,
			"Hear it and Play it start from a tapped note (got " + JSON.stringify(fromNote) + ")");
		await page.evaluate(function() { closeLevelUp(); });
		// Sliding across measures picks a part; Play it practices it note by note
		await page.evaluate(function() { playThroughSong("mary"); });
		var slide = await page.evaluate(function() {
			var r = practice.song.layouts[Object.keys(practice.song.layouts)[0]];
			function at(m) {
				var pt = r.svg.createSVGPoint();
				pt.x = (r.measureX[m][0] + r.measureX[m][1]) / 2;
				pt.y = r.stave.getYForLine(2);
				return pt.matrixTransform(r.svg.getScreenCTM());
			}
			var a = at(0), b = at(1);
			return { ax: a.x, ay: a.y, bx: b.x, by: b.y };
		});
		await page.mouse.move(slide.ax, slide.ay);
		await page.mouse.down();
		await page.mouse.move(slide.ax + 30, slide.ay, { steps: 3 });
		await page.mouse.move(slide.bx, slide.by, { steps: 5 });
		await page.mouse.up();
		var picked = await page.evaluate(function() {
			var p = practice.song.part;
			return { part: p ? p.a + "-" + p.b : null, label: document.getElementById("song-listen").textContent,
				shaded: document.querySelectorAll("#practice-staff-output .song-pick-shade").length };
		});
		await page.click("#song-listen");
		var practicing = await page.evaluate(function() {
			var s = practice.song;
			return { free: !!s.free, from: s.from || 0, to: s.to, measures: s.to !== undefined ? s.notes[s.to - 1].measure : null };
		});
		check(picked.part === "0-1" && picked.shaded === 2 && /Practice it/.test(picked.label) &&
			!practicing.free && practicing.from === 0 && practicing.measures === 1,
			"sliding across measures picks a part, and Play it practices it note by note (got " + JSON.stringify(picked) + ", " + JSON.stringify(practicing) + ")");
		// Note by note and Pick a part wait behind Play it through's \u22ef menu
		await page.evaluate(function() { playThroughSong("mary"); });
		// Play along's speeds wait behind the song's settings gear
		var speedsHidden = await page.evaluate(function() {
			return !document.querySelector("#practice-steps .speed-picker").offsetParent;
		});
		await page.click(".song-settings-toggle");
		check(speedsHidden && await page.evaluate(function() {
			return !!document.querySelector("#practice-steps .speed-picker").offsetParent;
		}), "Play along's speeds show only from the song's settings gear");
		// The settings turn the piano off and a metronome on: a click a beat
		await page.click(".song-click-picker >> text=On");
		await page.click(".song-piano-picker >> text=Off");
		var backing = await page.evaluate(function() {
			var hits = songBacking(practice.song.song, practice.song.events);
			var beats = practice.song.events.reduce(function(n, e) { return n + eventBeats(e); }, 0);
			var r = { hits: hits.length, beats: Math.round(beats), clicksOnly: hits.every(function(h) { return h.click; }),
				saved: localStorage.getItem("pitchdetect-song-piano") + localStorage.getItem("pitchdetect-song-click") };
			setSongPiano(true);
			setSongClick(false);
			return r;
		});
		check(backing.clicksOnly && backing.hits === backing.beats && backing.saved === "01",
			"the song's settings turn the piano off and the metronome on (" + backing.hits + " clicks, " + backing.beats + " beats)");
		// Hear the song plays the tune with its metronome: each note on the
		// audio clock at the same time as the click on its beat
		var together = await page.evaluate(async function() {
			var times = { note: [], click: [] }, wind = synthesizeWind, struck = synthesizeStruck, click = playClick;
			synthesizeWind = function(freq, timbre, t) { times.note.push(t); return wind.apply(this, arguments); };
			synthesizeStruck = function(freq, timbre, t, dest, sustain, nodes) {
				if (!nodes) times.note.push(t);  // (not the piano's)
				return struck.apply(this, arguments);
			};
			playClick = function(hit, t) { times.click.push(t); return click.apply(this, arguments); };
			setSongPiano(false);
			setSongClick(true);
			playSong();
			await new Promise(function(r) { setTimeout(r, 3000); });
			stopSongPlayback();
			synthesizeWind = wind;
			synthesizeStruck = struck;
			playClick = click;
			setSongPiano(true);
			setSongClick(false);
			// Mary's first notes are quarters, one a beat
			var n = Math.min(times.note.length, times.click.length);
			var worst = 0;
			for (var i = 0; i < n; i++) worst = Math.max(worst, Math.abs(times.note[i] - times.click[i]));
			return { n: n, worst: Math.round(worst * 1000) };
		});
		check(together.n >= 3 && together.worst <= 2,
			"Hear the song's notes sound with the metronome's clicks (" + together.n + " beats, " + together.worst + " ms apart at most)");
		await page.keyboard.press("Escape");
		await page.click(".song-settings-toggle");
		await page.click(".song-settings-more >> text=Note by note");
		check(await page.evaluate(function() { return practice.mode === "song" && !practice.song.free; }),
			"Play it through's settings open note by note");

		// Play along scores each note in time, over the piano: a note no
		// louder than the piano doesn't count, one played late is marked
		// late and doesn't score, and passing a speed opens the next. The mic
		// is replaced by frames playing each note as it comes, heard after
		// alongLag() (skip: a note played only as loud as the piano; late: a
		// note started past its on-time window). The count-in's clicks reach
		// the mic 150 ms after they're played (clickLag), which sets the delay.
		await page.evaluate(function() {
			window.realPracticeListen = updatePracticeListen;
			updatePracticeListen = function() {};
			ALONG_SPEEDS[1].tempo = 120;  // a late note needs room in its beat
			window.alongSim = { skip: -1, late: -1, clickLag: 150 };
			window.alongSimTimer = setInterval(function() {
				var s = practice.song, a = s && s.along;
				if (!a || a.done) return;
				var now = performance.now();
				if (!a.times.length) {
					// The count-in's clicks, heard from clickLag on: the level
					// over the mic's 85 ms window rises as the click fills it
					var since = a.clicks && a.clicks.length ? now - a.clicks[a.clicks.length - 1] : -1;
					var t = alongSim.clickLag === null ? -1 : since - alongSim.clickLag;
					var fill = t < 0 || t > 300 ? 0 : Math.min(t, 85) / 85;
					updateFollowListen(now, null, Math.sqrt(0.001 * 0.001 + 0.02 * 0.02 * fill));
					return;
				}
				var i = a.times.length - 1, e = s.events[i];
				var j = s.notes.findIndex(function(n) { return n.event === i; });
				var freq = e && e.midi !== null ? frequencyFromNoteNumber(e.midi - getTransposition()) : null;
				// A tongued gap at the start of each note, as long as the
				// app allows for the speakers and the mic (at least one frame,
				// should the timer run late); a late note's is longer
				var gap = alongLag(a) + (j === alongSim.late ? 1.5 * alongTolerance(60000 / a.speed.tempo) : 0);
				var level = !freq || a.ended || now - a.times[i] < gap || alongSim.last !== i ? 0.001 : j === alongSim.skip ? 0.015 : 0.2;
				alongSim.last = i;
				updateFollowListen(now, freq, level);
			}, 16);
			playThroughSong("auclair");
			songSpeed = "walk";
			alongSim.skip = 2;
			alongSim.late = 4;
			playAlong();
		});
		await page.waitForFunction(function() { return practice.song.done; }, null, { timeout: 30000 });
		var missed = await page.evaluate(function() {
			var s = practice.song;
			return { results: s.results.slice(), timing: s.timing.slice(), text: document.getElementById("practice-feedback").textContent,
				lag: s.along.lag, lagFrom: s.along.lagFrom,
				marks: Array.prototype.map.call(document.querySelectorAll("#practice-staff-output .song-mark"), function(t) { return t.textContent; }) };
		});
		check(missed.results[2] === "missed" && missed.results.filter(function(r) { return r === "right"; }).length === missed.results.length - 1,
			"Play along scores notes in time, and not one as quiet as the piano");
		check(missed.timing[4] === "late" && missed.timing.filter(Boolean).length === 1 &&
			missed.marks.join() === "late" && missed.text.indexOf(missed.results.length - 2 + " of ") >= 0,
			"Play along marks a late note late, and it doesn't score (got " + missed.text + ")");
		check(missed.lagFrom === "clicks" && Math.abs(missed.lag - 150 - 25) <= 20,
			"Play along measures the delay from its count-in's clicks (got " + missed.lagFrom + ", " + Math.round(missed.lag) + " ms)");
		await page.evaluate(function() {
			alongSim.skip = alongSim.late = -1;
			ALONG_SPEEDS[1].tempo = 160;  // quick, for the test (room for the delay)
			startAlong("walk");
		});
		await page.waitForFunction(function() { return practice.song.done; }, null, { timeout: 15000 });
		var passed = await page.evaluate(function() {
			var bunny = document.querySelectorAll("#practice-steps .speed-along")[2];
			return { text: document.getElementById("practice-feedback").textContent, bunnyOpen: !bunny.disabled,
				best: practice.songSpeedBest.auclair, total: practice.song.notes.length };
		});
		check(/Perfect/.test(passed.text) && passed.bunnyOpen && passed.best && passed.best.walk === passed.total,
			"a perfect Play along is saved and opens the next speed");
		// Without the clicks (headphones) the timing check's delay is used:
		// eight notes played 180 ms after their clicks
		await page.evaluate(function() {
			try { localStorage.removeItem(TIMING_CHECK_STORAGE_KEY); } catch (e) {}
			startTimingCheck();
			window.checkSim = setInterval(function() {
				var c = practice.song.check;
				if (!c || c.done || !c.clicks.length) return;
				var since = performance.now() - c.clicks[c.clicks.length - 1];
				updateFollowListen(performance.now(), since >= 80 && since < 400 ? 233 : null, 0.2);
			}, 16);
		});
		await page.waitForFunction(function() { return !practice.song.check; }, null, { timeout: 20000 });
		var checked = await page.evaluate(function() {
			clearInterval(checkSim);
			return { lag: storedTimingCheck(), text: document.getElementById("practice-feedback").textContent };
		});
		check(checked.lag && Math.abs(checked.lag - 80) <= 40 && /Timing set/.test(checked.text),
			"the timing check measures the delay from click to note (got " + checked.lag + " ms)");
		await page.evaluate(function() {
			alongSim.clickLag = null;
			startAlong("walk");
		});
		await page.waitForFunction(function() { return practice.song.along && practice.song.along.lag; }, null, { timeout: 15000 });
		var fromCheck = await page.evaluate(function() {
			var a = practice.song.along;
			stopSongPlayback();
			return { lag: a.lag, from: a.lagFrom };
		});
		check(fromCheck.from === "check" && fromCheck.lag === checked.lag,
			"Play along uses the timing check's delay when it can't hear its clicks (got " + fromCheck.from + ")");

		// Play it through: a note held 60 cents flat is that note, low; a
		// wrong note can be tapped to see what was played
		await page.evaluate(function() {
			playThroughSong("auclair");
			startFollow();
			practice.ignoreUntil = 0;
			var s = practice.song, t = performance.now();
			s.notes.forEach(function(n, j) {
				var midi = n.midi + (j === 1 ? -0.6 : j === 3 ? 2 : 0);
				var freq = frequencyFromNoteNumber(midi - getTransposition());
				for (var k = 0; k < 10; k++) updateFollowListen(t += 16, freq, 0.2);
				for (k = 0; k < 6; k++) updateFollowListen(t += 16, null, 0.001);
			});
			if (!s.done) finishFollow();
			closeLevelUp();  // the run's XP may have leveled up
		});
		var heardRun = await page.evaluate(function() {
			var s = practice.song, i = s.notes[3].event;
			var line = Object.keys(s.layouts).find(function(l) { return s.layouts[l].xs[i] !== undefined; });
			var r = s.layouts[line], pt = r.svg.createSVGPoint();
			pt.x = r.xs[i];
			pt.y = r.stave.getYForLine(2);
			var p = pt.matrixTransform(r.svg.getScreenCTM());
			return { results: s.results.slice(), x: p.x, y: p.y,
				marks: Array.prototype.map.call(document.querySelectorAll("#practice-staff-output .song-mark"), function(t) { return t.textContent; }),
				sub: document.getElementById("practice-feedback-sub").textContent };
		});
		check(heardRun.results[1] === "low" && heardRun.results[3] === "wrong" && heardRun.marks.join() === "low" &&
			heardRun.results.filter(function(r) { return r === "right"; }).length === heardRun.results.length - 2 &&
			/1 low/.test(heardRun.sub),
			"Play it through marks a note played out of tune low, not missed (got " + heardRun.sub + ")");
		await page.mouse.click(heardRun.x, heardRun.y);
		var heardTap = await page.evaluate(function() {
			var s = practice.song, el = document.querySelector("#song-fingering .song-fingering-heard");
			return { text: el ? el.textContent : "", ghost: !!document.querySelector("#practice-staff-output .vf-practice-ghost"),
				want: "You played " + practiceNoteName(s.notes[3].midi + 2) };
		});
		check(heardTap.text === heardTap.want && heardTap.ghost,
			"a tapped wrong note shows what was played (got " + heardTap.text + ")");

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

		// Eighths are beamed by beat: after a dotted quarter in 3/4 the
		// offbeat eighth stands alone and beat 3's pair is beamed
		var beamed = await page.evaluate(function() {
			var n = function(d, dot) { return { s: 30, a: 0, d: d, dot: dot ? 1 : 0 }; };
			var song = { custom: true, key: "C", time: "3/4", notes: [n("q", true), n("8"), n("8"), n("8")] };
			var events = customSongEvents(song);
			var groups = [], draw = Vex.Flow.Beam.prototype.draw;
			Vex.Flow.Beam.prototype.draw = function() { groups.push(this.notes); return draw.apply(this, arguments); };
			var out = document.createElement("div");
			document.body.appendChild(out);
			var layout = renderSongLine(out, song, events, 0, 1, {}, function() { return null; });
			out.remove();
			Vex.Flow.Beam.prototype.draw = draw;
			// Which events each beam holds, by their x on the staff
			return groups.map(function(notes) {
				return notes.map(function(t) {
					var x = t.getAbsoluteX() + t.getGlyphWidth() / 2;
					return Object.keys(layout.xs).filter(function(i) { return Math.abs(layout.xs[i] - x) < 0.5; })[0];
				}).join("+");
			}).join(",");
		});
		check(beamed === "2+3", "after a dotted quarter, beat 3's eighths are beamed and the offbeat one isn't (got " + beamed + ")");

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

		// Slurred notes play legato, drawn with a slur; a slur left open is
		// refused
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
			// Played: one tone per note, the slurred ones crossfading from
			// the note before (legato) instead of starting after a gap
			var tones = [], play = playTone;
			playTone = function(f, sustain, started, len, legato) { tones.push(legato ? 1 : 0); };
			return new Promise(function(resolve) {
				playSongEvents(events, function() {}, { tempo: 2000, onEnd: function() {
					playTone = play;
					resolve({ legato: events.map(function(e) { return e.legato ? 1 : 0; }).join(""), tones: tones.join(""), drawn: drawn, open: open });
				} });
			});
		});
		check(slur.legato === "0110" && slur.tones === "0110" && slur.drawn === 1 && slur.open === null,
			"slurred notes play legato and are drawn with a slur; an open slur is refused (got " + slur.tones + ")");

		// A friend's song link goes straight into My songs and opens in Play
		// it through (whole, four measures a line on a desktop); opening it
		// again doesn't add a second copy
		var imported = await page.evaluate(function() {
			var n = function(s) { return { s: s, a: 0, d: "w", dot: 0 }; };
			var notes = [28, 29, 30, 31, 32, 33, 34, 35, 34].map(n);
			var link = encodeSongShare({ title: "Shared", key: "C", time: "4/4", notes: notes }, "trumpet");
			var count = function() { return practice.customSongs.filter(function(s) { return s.title === "Shared"; }).length; };
			pendingSongImport = decodeSongShare(link);
			openSongImport();
			var first = { mode: practice.mode, free: !!(practice.song && practice.song.free), title: practice.song && practice.song.song.title,
				lines: document.querySelectorAll("#practice-staff-output .song-line").length, copies: count() };
			pendingSongImport = decodeSongShare(link);
			openSongImport();
			first.again = count();
			return first;
		});
		check(imported.mode === "song" && imported.free && imported.title === "Shared" && imported.lines === 3 && imported.copies === 1 && imported.again === 1,
			"a shared song opens in Play it through, 4 measures a line, added to My songs once (got " + JSON.stringify(imported) + ")");

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
