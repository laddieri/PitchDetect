/*
 * Service worker: makes the app installable and lets it run offline.
 * Network first, so a new version reaches students as soon as they're
 * online; whatever was fetched is kept, and used when the network isn't
 * there. The app's own files are fetched at install, so it works offline
 * after one visit; fingering charts are kept as they're viewed.
 */
var CACHE = "pitchdetect-v1";
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
	"img/icon-192.png"
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
	event.respondWith(fetch(request).then(function(response) {
		if (response.ok || response.type === "opaque") {
			var copy = response.clone();
			caches.open(CACHE).then(function(cache) { cache.put(request, copy); });
		}
		return response;
	}).catch(function() {
		return caches.match(request, { ignoreSearch: true }).then(function(hit) {
			return hit || (request.mode === "navigate" ? caches.match("index.html") : Response.error());
		});
	}));
});
