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
