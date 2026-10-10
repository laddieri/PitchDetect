/*
 * Service worker: makes the app installable and lets it run offline.
 * Network first, so a new version reaches students as soon as they're
 * online; whatever was fetched is kept, and used when the network isn't
 * there. The app's own files are fetched at install, so it works offline
 * after one visit; fingering charts are kept as they're viewed, and the
 * page fetches the rest of the selected instrument's charts in the
 * background (cacheInstrumentCharts() in progress.js). On a slow network
 * (a crowded school Wi-Fi) a saved copy is used after NETWORK_TIMEOUT_MS
 * rather than waiting; the network's answer still updates the cache.
 */
var CACHE = "pitchdetect-v1";
var NETWORK_TIMEOUT_MS = 3000;
var APP_FILES = [
	"./",
	"index.html",
	"manifest.webmanifest",
	"js/vendor/vexflow-min.js",
	"js/fingerings.js",
	"js/notetrainer.js",
	"js/firstfive.js",
	"js/progress.js",
	"img/favicon.svg",
	"img/icon-192.png",
	"img/icon-512.png",
	"favicon.ico"
];

self.addEventListener("install", function(event) {
	event.waitUntil(caches.open(CACHE).then(function(cache) {
		return cache.addAll(APP_FILES);
	}).then(function() {
		return self.skipWaiting();
	}));
});

self.addEventListener("activate", function(event) {
	event.waitUntil(caches.keys().then(function(keys) {
		return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) {
			return caches.delete(k);
		}));
	}).then(function() {
		return self.clients.claim();
	}));
});

self.addEventListener("fetch", function(event) {
	var request = event.request;
	if (request.method !== "GET" || !/^https?:/.test(request.url)) return;
	var network = fetch(request);
	// Registered first, so the copy is taken before the page reads the body
	var stored = network.then(function(response) {
		if (!response.ok && response.type !== "opaque") return;
		var copy = response.clone();
		return caches.open(CACHE).then(function(cache) { return cache.put(request, copy); });
	});
	function saved() {
		return caches.match(request, { ignoreSearch: true }).then(function(hit) {
			return hit || (request.mode === "navigate" ? caches.match("index.html") : undefined);
		});
	}
	event.respondWith(new Promise(function(resolve) {
		var done = false;
		function finish(response) {
			if (done) return;
			done = true;
			resolve(response);
		}
		// Too slow: answer from the cache if there's a copy, else keep waiting
		var timer = setTimeout(function() {
			saved().then(function(hit) { if (hit) finish(hit); });
		}, NETWORK_TIMEOUT_MS);
		network.then(function(response) {
			clearTimeout(timer);
			finish(response);
		}, function() {
			clearTimeout(timer);
			saved().then(function(hit) { finish(hit || Response.error()); });
		});
	}));
	// Let the network's copy reach the cache, even after a cached answer
	event.waitUntil(stored.catch(function() {}));
});
